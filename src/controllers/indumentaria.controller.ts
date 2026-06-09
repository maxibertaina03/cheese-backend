import { Response } from 'express';
import { Between } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Indumentaria } from '../entities/Indumentaria';
import { MovimientoIndumentaria } from '../entities/MovimientoIndumentaria';
import { Proveedor } from '../entities/Proveedor';
import { Usuario } from '../entities/Usuario';
import { AuthRequest } from '../middlewares/auth';

type ControllerErrorResult = {
  error: {
    status: number;
    payload: { error: string };
  };
};

type CreateResult = ControllerErrorResult | Indumentaria | null;

type MovementResult =
  | ControllerErrorResult
  | {
      message: string;
      stockAnterior: number;
      stockNuevo: number;
      movimiento: MovimientoIndumentaria;
      alerta?: {
        tipo: string;
        mensaje: string;
        stockActual: number;
        stockMinimo: number;
      } | null;
    };

export class IndumentariaController {
  static async getAll(req: AuthRequest, res: Response) {
    try {
      const repo = AppDataSource.getRepository(Indumentaria);
      const { categoria, proveedorId } = req.query;

      const where: any = { activo: true };
      if (categoria && categoria !== 'todas') {
        where.categoria = categoria;
      }
      if (proveedorId) {
        where.proveedor = { id: Number(proveedorId) };
      }

      const prendas = await repo.find({
        where,
        relations: ['proveedor', 'creadoPor'],
        order: { createdAt: 'DESC' },
      });

      res.json(prendas);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      const {
        nombre,
        stockInicial,
        stockMinimo,
        categoria,
        talle,
        color,
        genero,
        ubicacion,
        proveedorId,
        observaciones,
      } = req.body;

      const stockInicialNum = Number(stockInicial);
      const stockMinimoNum = stockMinimo === undefined ? 0 : Number(stockMinimo);

      if (!nombre || stockInicial === undefined) {
        return res.status(400).json({
          error: 'El nombre y el stock inicial son obligatorios',
        });
      }

      if (!proveedorId) {
        return res.status(400).json({
          error: 'El proveedor es obligatorio',
        });
      }

      const result: CreateResult = await AppDataSource.transaction(
        async (manager): Promise<CreateResult> => {
          const repo = manager.getRepository(Indumentaria);
          const proveedorRepo = manager.getRepository(Proveedor);
          const usuarioRepo = manager.getRepository(Usuario);
          const movimientoRepo = manager.getRepository(MovimientoIndumentaria);

          let proveedor: Proveedor | null = null;
          if (proveedorId) {
            proveedor = await proveedorRepo.findOneBy({ id: proveedorId });
            if (!proveedor) {
              return {
                error: {
                  status: 404,
                  payload: { error: 'Proveedor no encontrado' },
                },
              } satisfies ControllerErrorResult;
            }
          }

          let usuarioCreador: Usuario | null = null;
          if (req.user?.id) {
            usuarioCreador = await usuarioRepo.findOneBy({ id: req.user.id });
          }

          const prenda = repo.create({
            nombre,
            categoria: categoria ?? null,
            talle: talle ?? null,
            color: color ?? null,
            genero: genero ?? null,
            ubicacion: ubicacion ?? null,
            cantidadDisponible: stockInicialNum,
            cantidadTotalIngresada: stockInicialNum,
            stockMinimo: stockMinimoNum,
            proveedor,
            observaciones: observaciones ?? null,
            creadoPor: usuarioCreador,
          });

          await repo.save(prenda);

          if (stockInicialNum > 0) {
            const movimiento = movimientoRepo.create({
              indumentaria: prenda,
              tipo: 'INGRESO',
              cantidad: stockInicialNum,
              stockAnterior: 0,
              stockNuevo: stockInicialNum,
              proveedor,
              fechaMovimiento: new Date(),
              usuario: usuarioCreador,
              observaciones: 'Stock inicial',
            });
            await movimientoRepo.save(movimiento);
          }

          return repo.findOne({
            where: { id: prenda.id },
            relations: ['proveedor', 'creadoPor'],
          });
        }
      );

      if (result && 'error' in result) {
        return res.status(result.error.status).json(result.error.payload);
      }

      res.status(201).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async ingresarStock(req: AuthRequest, res: Response) {
    try {
      const { cantidad, proveedorId, documentoReferencia, observaciones } = req.body;
      const cantidadNum = Number(cantidad);

      if (!cantidadNum || cantidadNum <= 0) {
        return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
      }

      if (!proveedorId) {
        return res.status(400).json({ error: 'El proveedor es obligatorio' });
      }

      const result: MovementResult = await AppDataSource.transaction(
        async (manager): Promise<MovementResult> => {
          const repo = manager.getRepository(Indumentaria);
          const movimientoRepo = manager.getRepository(MovimientoIndumentaria);
          const proveedorRepo = manager.getRepository(Proveedor);
          const usuarioRepo = manager.getRepository(Usuario);

          const prenda = await repo
            .createQueryBuilder('indumentaria')
            .setLock('pessimistic_write')
            .where('indumentaria.id = :id', { id: Number(req.params.id) })
            .getOne();

          if (!prenda) {
            return {
              error: { status: 404, payload: { error: 'Indumentaria no encontrada' } },
            } satisfies ControllerErrorResult;
          }

          if (!prenda.activo) {
            return {
              error: { status: 400, payload: { error: 'Esta prenda esta inactiva' } },
            } satisfies ControllerErrorResult;
          }

          let proveedor: Proveedor | null = null;
          if (proveedorId) {
            proveedor = await proveedorRepo.findOneBy({ id: proveedorId });
            if (!proveedor) {
              return {
                error: { status: 404, payload: { error: 'Proveedor no encontrado' } },
              } satisfies ControllerErrorResult;
            }
          }

          let usuario: Usuario | null = null;
          if (req.user?.id) {
            usuario = await usuarioRepo.findOneBy({ id: req.user.id });
          }

          const stockAnterior = Number(prenda.cantidadDisponible);
          const stockNuevo = stockAnterior + cantidadNum;

          prenda.cantidadDisponible = stockNuevo;
          prenda.cantidadTotalIngresada = Number(prenda.cantidadTotalIngresada) + cantidadNum;
          await repo.save(prenda);

          const movimiento = movimientoRepo.create({
            indumentaria: prenda,
            tipo: 'INGRESO',
            cantidad: cantidadNum,
            stockAnterior,
            stockNuevo,
            proveedor,
            documentoReferencia: documentoReferencia ?? null,
            observaciones: observaciones ?? null,
            fechaMovimiento: new Date(),
            usuario,
          });
          await movimientoRepo.save(movimiento);

          return {
            message: 'Ingreso registrado exitosamente',
            stockAnterior,
            stockNuevo,
            movimiento,
          };
        }
      );

      if ('error' in result) {
        return res.status(result.error.status).json(result.error.payload);
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async egresarStock(req: AuthRequest, res: Response) {
    try {
      const { cantidad, destino, observaciones } = req.body;
      const cantidadNum = Number(cantidad);

      if (!cantidadNum || cantidadNum <= 0) {
        return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
      }

      if (!destino) {
        return res.status(400).json({ error: 'El destino de la entrega es obligatorio' });
      }

      const result: MovementResult = await AppDataSource.transaction(
        async (manager): Promise<MovementResult> => {
          const repo = manager.getRepository(Indumentaria);
          const movimientoRepo = manager.getRepository(MovimientoIndumentaria);
          const usuarioRepo = manager.getRepository(Usuario);

          const prenda = await repo
            .createQueryBuilder('indumentaria')
            .setLock('pessimistic_write')
            .where('indumentaria.id = :id', { id: Number(req.params.id) })
            .getOne();

          if (!prenda) {
            return {
              error: { status: 404, payload: { error: 'Indumentaria no encontrada' } },
            } satisfies ControllerErrorResult;
          }

          const stockAnterior = Number(prenda.cantidadDisponible);
          if (stockAnterior < cantidadNum) {
            return {
              error: {
                status: 400,
                payload: { error: `Stock insuficiente. Disponible: ${stockAnterior}` },
              },
            } satisfies ControllerErrorResult;
          }

          let usuario: Usuario | null = null;
          if (req.user?.id) {
            usuario = await usuarioRepo.findOneBy({ id: req.user.id });
          }

          const stockNuevo = stockAnterior - cantidadNum;

          prenda.cantidadDisponible = stockNuevo;
          await repo.save(prenda);

          const movimiento = movimientoRepo.create({
            indumentaria: prenda,
            tipo: 'EGRESO',
            cantidad: cantidadNum,
            stockAnterior,
            stockNuevo,
            destino,
            observaciones: observaciones ?? null,
            fechaMovimiento: new Date(),
            usuario,
          });
          await movimientoRepo.save(movimiento);

          let alerta = null;
          const stockMinimoActual = Number(prenda.stockMinimo);
          if (stockMinimoActual > 0 && stockNuevo <= stockMinimoActual) {
            alerta = {
              tipo: 'STOCK_BAJO',
              mensaje: `Stock por debajo del minimo (${stockMinimoActual})`,
              stockActual: stockNuevo,
              stockMinimo: stockMinimoActual,
            };
          }

          return {
            message: 'Entrega registrada exitosamente',
            stockAnterior,
            stockNuevo,
            movimiento,
            alerta,
          };
        }
      );

      if ('error' in result) {
        return res.status(result.error.status).json(result.error.payload);
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async ajusteStock(req: AuthRequest, res: Response) {
    try {
      const { cantidad, motivo, observaciones } = req.body;
      const cantidadNum = Number(cantidad);

      if (!cantidadNum || cantidadNum === 0) {
        return res.status(400).json({ error: 'La cantidad no puede ser 0' });
      }

      if (!motivo) {
        return res.status(400).json({ error: 'El motivo del ajuste es obligatorio' });
      }

      const result: MovementResult = await AppDataSource.transaction(
        async (manager): Promise<MovementResult> => {
          const repo = manager.getRepository(Indumentaria);
          const movimientoRepo = manager.getRepository(MovimientoIndumentaria);
          const usuarioRepo = manager.getRepository(Usuario);

          const prenda = await repo
            .createQueryBuilder('indumentaria')
            .setLock('pessimistic_write')
            .where('indumentaria.id = :id', { id: Number(req.params.id) })
            .getOne();

          if (!prenda) {
            return {
              error: { status: 404, payload: { error: 'Indumentaria no encontrada' } },
            } satisfies ControllerErrorResult;
          }

          let usuario: Usuario | null = null;
          if (req.user?.id) {
            usuario = await usuarioRepo.findOneBy({ id: req.user.id });
          }

          const stockAnterior = Number(prenda.cantidadDisponible);
          const stockNuevo = stockAnterior + cantidadNum;

          if (stockNuevo < 0) {
            return {
              error: {
                status: 400,
                payload: { error: 'El ajuste dejaria el stock en negativo' },
              },
            } satisfies ControllerErrorResult;
          }

          prenda.cantidadDisponible = stockNuevo;
          if (cantidadNum > 0) {
            prenda.cantidadTotalIngresada = Number(prenda.cantidadTotalIngresada) + cantidadNum;
          }
          await repo.save(prenda);

          const movimiento = movimientoRepo.create({
            indumentaria: prenda,
            tipo: 'AJUSTE',
            cantidad: Math.abs(cantidadNum),
            stockAnterior,
            stockNuevo,
            observaciones: `${motivo}${observaciones ? ' - ' + observaciones : ''}`,
            fechaMovimiento: new Date(),
            usuario,
          });
          await movimientoRepo.save(movimiento);

          return {
            message: 'Ajuste registrado',
            stockAnterior,
            stockNuevo,
            movimiento,
          };
        }
      );

      if ('error' in result) {
        return res.status(result.error.status).json(result.error.payload);
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getMovimientos(req: AuthRequest, res: Response) {
    try {
      const { fechaInicio, fechaFin, tipo } = req.query;
      const movimientoRepo = AppDataSource.getRepository(MovimientoIndumentaria);

      const where: any = {
        indumentaria: { id: Number(req.params.id) },
      };

      if (tipo && tipo !== 'todos') {
        where.tipo = tipo;
      }

      if (fechaInicio && fechaFin) {
        where.fechaMovimiento = Between(
          new Date(fechaInicio as string),
          new Date(fechaFin as string)
        );
      }

      const movimientos = await movimientoRepo.find({
        where,
        relations: ['proveedor', 'usuario'],
        order: { fechaMovimiento: 'DESC', createdAt: 'DESC' },
      });

      res.json(movimientos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getStockBajo(_req: AuthRequest, res: Response) {
    try {
      const repo = AppDataSource.getRepository(Indumentaria);

      const bajos = await repo
        .createQueryBuilder('prenda')
        .leftJoinAndSelect('prenda.proveedor', 'proveedor')
        .where('prenda.activo = :activo', { activo: true })
        .andWhere('prenda.stockMinimo > 0')
        .andWhere('prenda.cantidadDisponible <= prenda.stockMinimo')
        .orderBy('prenda.cantidadDisponible', 'ASC')
        .getMany();

      res.json({
        total: bajos.length,
        elementos: bajos,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const {
        stockMinimo,
        categoria,
        talle,
        color,
        genero,
        ubicacion,
        proveedorId,
        observaciones,
      } = req.body;
      const repo = AppDataSource.getRepository(Indumentaria);

      const prenda = await repo.findOneBy({ id: Number(req.params.id) });
      if (!prenda) {
        return res.status(404).json({ error: 'Indumentaria no encontrada' });
      }

      if (stockMinimo !== undefined) prenda.stockMinimo = stockMinimo;
      if (categoria !== undefined) prenda.categoria = categoria;
      if (talle !== undefined) prenda.talle = talle;
      if (color !== undefined) prenda.color = color;
      if (genero !== undefined) prenda.genero = genero;
      if (ubicacion !== undefined) prenda.ubicacion = ubicacion;
      if (observaciones !== undefined) prenda.observaciones = observaciones;

      if (proveedorId !== undefined) {
        if (proveedorId === null) {
          prenda.proveedor = null;
        } else {
          const proveedor = await AppDataSource.getRepository(Proveedor).findOneBy({
            id: proveedorId,
          });
          if (!proveedor) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
          }
          prenda.proveedor = proveedor;
        }
      }

      if (req.user?.id) {
        prenda.modificadoPor = await AppDataSource.getRepository(Usuario).findOneBy({
          id: req.user.id,
        });
      }

      await repo.save(prenda);
      res.json(prenda);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      const repo = AppDataSource.getRepository(Indumentaria);
      const prenda = await repo.findOneBy({ id: Number(req.params.id) });
      if (!prenda) {
        return res.status(404).json({ error: 'Indumentaria no encontrada' });
      }

      prenda.activo = false;
      if (req.user?.id) {
        prenda.eliminadoPor = await AppDataSource.getRepository(Usuario).findOneBy({
          id: req.user.id,
        });
      }
      await repo.save(prenda);

      res.json({ message: 'Indumentaria desactivada exitosamente' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

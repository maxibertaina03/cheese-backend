import { Response } from 'express';
import { Between } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Motivo } from '../entities/Motivo';
import { MovimientoStock } from '../entities/MovimientoStock';
import { StockElemento } from '../entities/StockElemento';
import { TipoElemento } from '../entities/TipoElemento';
import { Usuario } from '../entities/Usuario';
import { AuthRequest } from '../middlewares/auth';

type ControllerErrorResult = {
  error: {
    status: number;
    payload: { error: string };
  };
};

type StockCreateResult = ControllerErrorResult | StockElemento | null;

type StockMovementResult =
  | ControllerErrorResult
  | {
      message: string;
      stockAnterior: number;
      stockNuevo: number;
      movimiento: MovimientoStock;
      alerta?: {
        tipo: string;
        mensaje: string;
        stockActual: number;
        stockMinimo: number;
      } | null;
    };

export class StockElementoController {
  static async getAll(_req: AuthRequest, res: Response) {
    try {
      const stockRepo = AppDataSource.getRepository(StockElemento);

      const stocks = await stockRepo.find({
        where: { activo: true },
        relations: ['tipo', 'creadoPor'],
        order: { createdAt: 'DESC' },
      });

      res.json(stocks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      const { tipoId, stockInicial, stockMinimo, ubicacion, observaciones } = req.body;
      const stockInicialNum = Number(stockInicial);
      const stockMinimoNum = stockMinimo === undefined ? 0 : Number(stockMinimo);

      if (!tipoId || stockInicial === undefined) {
        return res.status(400).json({
          error: 'El tipo y stock inicial son obligatorios',
        });
      }

      const result: StockCreateResult = await AppDataSource.transaction(
        async (manager): Promise<StockCreateResult> => {
          const stockRepo = manager.getRepository(StockElemento);
          const tipoRepo = manager.getRepository(TipoElemento);
          const usuarioRepo = manager.getRepository(Usuario);
          const movimientoRepo = manager.getRepository(MovimientoStock);

          const tipo = await tipoRepo.findOneBy({ id: tipoId });
          if (!tipo) {
            return {
              error: {
                status: 404,
                payload: { error: 'Tipo de elemento no encontrado' },
              },
            } satisfies ControllerErrorResult;
          }

          const existente = await stockRepo.findOne({
            where: {
              tipo: { id: tipoId },
              ubicacion: ubicacion || null,
              activo: true,
            },
          });

          if (existente) {
            return {
              error: {
                status: 400,
                payload: { error: 'Ya existe stock para este tipo en esta ubicacion. Use ingreso de stock.' },
              },
            } satisfies ControllerErrorResult;
          }

          let usuarioCreador = null;
          if (req.user?.id) {
            usuarioCreador = await usuarioRepo.findOneBy({ id: req.user.id });
          }

          const stockElemento = stockRepo.create({
            tipo,
            stockActual: stockInicialNum,
            stockMinimo: stockMinimoNum || 0,
            stockTotalIngresado: stockInicialNum,
            ubicacion: ubicacion || null,
            observaciones,
            creadoPor: usuarioCreador,
          });

          await stockRepo.save(stockElemento);

          const movimiento = movimientoRepo.create({
            stockElemento,
            tipo: 'INGRESO',
            cantidad: stockInicialNum,
            stockAnterior: 0,
            stockNuevo: stockInicialNum,
            fechaMovimiento: new Date(),
            usuario: usuarioCreador,
            observaciones: 'Stock inicial',
          });
          await movimientoRepo.save(movimiento);

          return stockRepo.findOne({
            where: { id: stockElemento.id },
            relations: ['tipo', 'creadoPor'],
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
      const { cantidad, observaciones, documentoReferencia } = req.body;
      const cantidadNum = Number(cantidad);

      if (!cantidadNum || cantidadNum <= 0) {
        return res.status(400).json({
          error: 'La cantidad debe ser mayor a 0',
        });
      }

      const result: StockMovementResult = await AppDataSource.transaction(
        async (manager): Promise<StockMovementResult> => {
          const stockRepo = manager.getRepository(StockElemento);
          const movimientoRepo = manager.getRepository(MovimientoStock);
          const usuarioRepo = manager.getRepository(Usuario);

          const stockElemento = await stockRepo.findOne({
            where: { id: Number(req.params.id) },
            relations: ['tipo'],
            lock: { mode: 'pessimistic_write' },
          });

          if (!stockElemento) {
            return {
              error: {
                status: 404,
                payload: { error: 'Stock no encontrado' },
              },
            } satisfies ControllerErrorResult;
          }

          if (!stockElemento.activo) {
            return {
              error: {
                status: 400,
                payload: { error: 'Este elemento de stock esta inactivo' },
              },
            } satisfies ControllerErrorResult;
          }

          let usuario = null;
          if (req.user?.id) {
            usuario = await usuarioRepo.findOneBy({ id: req.user.id });
          }

          const stockAnterior = Number(stockElemento.stockActual);
          const stockNuevo = stockAnterior + cantidadNum;

          stockElemento.stockActual = stockNuevo;
          stockElemento.stockTotalIngresado = Number(stockElemento.stockTotalIngresado) + cantidadNum;
          await stockRepo.save(stockElemento);

          const movimiento = movimientoRepo.create({
            stockElemento,
            tipo: 'INGRESO',
            cantidad: cantidadNum,
            stockAnterior,
            stockNuevo,
            fechaMovimiento: new Date(),
            documentoReferencia: documentoReferencia || null,
            observaciones: observaciones || null,
            usuario,
          });
          await movimientoRepo.save(movimiento);

          return {
            message: 'Stock ingresado exitosamente',
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
      const { cantidad, motivoId, observaciones, documentoReferencia } = req.body;
      const cantidadNum = Number(cantidad);

      if (!cantidadNum || cantidadNum <= 0) {
        return res.status(400).json({
          error: 'La cantidad debe ser mayor a 0',
        });
      }

      if (!motivoId) {
        return res.status(400).json({
          error: 'El motivo del egreso es obligatorio',
        });
      }

      const result: StockMovementResult = await AppDataSource.transaction(
        async (manager): Promise<StockMovementResult> => {
          const stockRepo = manager.getRepository(StockElemento);
          const movimientoRepo = manager.getRepository(MovimientoStock);
          const motivoRepo = manager.getRepository(Motivo);
          const usuarioRepo = manager.getRepository(Usuario);

          const stockElemento = await stockRepo.findOne({
            where: { id: Number(req.params.id) },
            relations: ['tipo'],
            lock: { mode: 'pessimistic_write' },
          });

          if (!stockElemento) {
            return {
              error: {
                status: 404,
                payload: { error: 'Stock no encontrado' },
              },
            } satisfies ControllerErrorResult;
          }

          const stockAnterior = Number(stockElemento.stockActual);
          if (stockAnterior < cantidadNum) {
            return {
              error: {
                status: 400,
                payload: { error: `Stock insuficiente. Disponible: ${stockAnterior}` },
              },
            } satisfies ControllerErrorResult;
          }

          const motivo = await motivoRepo.findOneBy({ id: motivoId });
          if (!motivo) {
            return {
              error: {
                status: 404,
                payload: { error: 'Motivo no encontrado' },
              },
            } satisfies ControllerErrorResult;
          }

          let usuario = null;
          if (req.user?.id) {
            usuario = await usuarioRepo.findOneBy({ id: req.user.id });
          }

          const stockNuevo = stockAnterior - cantidadNum;

          stockElemento.stockActual = stockNuevo;
          await stockRepo.save(stockElemento);

          const movimiento = movimientoRepo.create({
            stockElemento,
            tipo: 'EGRESO',
            cantidad: cantidadNum,
            stockAnterior,
            stockNuevo,
            motivo,
            fechaMovimiento: new Date(),
            documentoReferencia: documentoReferencia || null,
            observaciones: observaciones || null,
            usuario,
          });
          await movimientoRepo.save(movimiento);

          let alerta = null;
          const stockMinimoActual = Number(stockElemento.stockMinimo);
          if (stockMinimoActual > 0 && stockNuevo < stockMinimoActual) {
            alerta = {
              tipo: 'STOCK_BAJO',
              mensaje: `Stock por debajo del minimo (${stockMinimoActual})`,
              stockActual: stockNuevo,
              stockMinimo: stockMinimoActual,
            };
          }

          return {
            message: 'Stock egresado exitosamente',
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

  static async getMovimientos(req: AuthRequest, res: Response) {
    try {
      const { fechaInicio, fechaFin, tipo } = req.query;
      const movimientoRepo = AppDataSource.getRepository(MovimientoStock);

      const where: any = {
        stockElemento: { id: Number(req.params.id) },
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
        relations: ['motivo', 'usuario'],
        order: { fechaMovimiento: 'DESC', createdAt: 'DESC' },
      });

      res.json(movimientos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getStockBajo(_req: AuthRequest, res: Response) {
    try {
      const stockRepo = AppDataSource.getRepository(StockElemento);

      const stocksBajos = await stockRepo
        .createQueryBuilder('stock')
        .leftJoinAndSelect('stock.tipo', 'tipo')
        .where('stock.activo = :activo', { activo: true })
        .andWhere('stock.stockMinimo > 0')
        .andWhere('stock.stockActual <= stock.stockMinimo')
        .orderBy('stock.stockActual', 'ASC')
        .getMany();

      res.json({
        total: stocksBajos.length,
        elementos: stocksBajos,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const { stockMinimo, ubicacion, observaciones } = req.body;
      const stockRepo = AppDataSource.getRepository(StockElemento);

      const stockElemento = await stockRepo.findOneBy({
        id: Number(req.params.id),
      });

      if (!stockElemento) {
        return res.status(404).json({ error: 'Stock no encontrado' });
      }

      if (stockMinimo !== undefined) stockElemento.stockMinimo = stockMinimo;
      if (ubicacion !== undefined) stockElemento.ubicacion = ubicacion;
      if (observaciones !== undefined) stockElemento.observaciones = observaciones;

      await stockRepo.save(stockElemento);

      res.json(stockElemento);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async ajusteStock(req: AuthRequest, res: Response) {
    try {
      const { cantidad, motivo, observaciones } = req.body;
      const cantidadNum = Number(cantidad);

      if (!cantidadNum || cantidadNum === 0) {
        return res.status(400).json({
          error: 'La cantidad no puede ser 0',
        });
      }

      if (!motivo) {
        return res.status(400).json({
          error: 'El motivo del ajuste es obligatorio',
        });
      }

      const result: StockMovementResult = await AppDataSource.transaction(
        async (manager): Promise<StockMovementResult> => {
          const stockRepo = manager.getRepository(StockElemento);
          const movimientoRepo = manager.getRepository(MovimientoStock);
          const usuarioRepo = manager.getRepository(Usuario);

          const stockElemento = await stockRepo.findOne({
            where: { id: Number(req.params.id) },
            relations: ['tipo'],
            lock: { mode: 'pessimistic_write' },
          });

          if (!stockElemento) {
            return {
              error: {
                status: 404,
                payload: { error: 'Stock no encontrado' },
              },
            } satisfies ControllerErrorResult;
          }

          let usuario = null;
          if (req.user?.id) {
            usuario = await usuarioRepo.findOneBy({ id: req.user.id });
          }

          const stockAnterior = Number(stockElemento.stockActual);
          const stockNuevo = stockAnterior + cantidadNum;

          if (stockNuevo < 0) {
            return {
              error: {
                status: 400,
                payload: { error: 'El ajuste dejaria el stock en negativo' },
              },
            } satisfies ControllerErrorResult;
          }

          stockElemento.stockActual = stockNuevo;

          if (cantidadNum > 0) {
            stockElemento.stockTotalIngresado = Number(stockElemento.stockTotalIngresado) + cantidadNum;
          }

          await stockRepo.save(stockElemento);

          const movimiento = movimientoRepo.create({
            stockElemento,
            tipo: 'AJUSTE',
            cantidad: Math.abs(cantidadNum),
            stockAnterior,
            stockNuevo,
            fechaMovimiento: new Date(),
            observaciones: `${motivo}${observaciones ? ' - ' + observaciones : ''}`,
            usuario,
          });
          await movimientoRepo.save(movimiento);

          return {
            message: 'Ajuste de stock registrado',
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
}

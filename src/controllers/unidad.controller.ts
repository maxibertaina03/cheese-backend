import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Motivo } from '../entities/Motivo';
import { Particion } from '../entities/Particion';
import { Producto } from '../entities/Producto';
import { Unidad } from '../entities/Unidad';
import { Usuario } from '../entities/Usuario';
import { AuthRequest } from '../middlewares/auth';

type ControllerErrorResult = {
  error: {
    status: number;
    payload: { error: string };
  };
};

type AddParticionResult =
  | ControllerErrorResult
  | {
      unidad: Unidad;
      particion: Particion | null;
    };

// Calcula el inicio (00:00) del lunes más reciente, en horario local del servidor.
// Se usa solo como fallback: normalmente el frontend envía la fecha de corte ya
// calculada en la zona horaria del usuario.
const getUltimoLunes = (): Date => {
  const now = new Date();
  const day = now.getDay(); // 0 = domingo, 1 = lunes, ...
  const diasDesdeLunes = (day + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diasDesdeLunes, 0, 0, 0, 0);
};

export class UnidadController {
  static async create(req: AuthRequest, res: Response) {
    try {
      const { productoId, pesoInicial, observacionesIngreso, motivoId } = req.body;

      if (!motivoId) {
        return res.status(400).json({ error: 'El motivo de ingreso es obligatorio' });
      }

      const motivoRepo = AppDataSource.getRepository(Motivo);
      const motivo = await motivoRepo.findOneBy({ id: motivoId });

      if (!motivo) {
        return res.status(404).json({ error: 'Motivo no encontrado' });
      }

      if (!productoId || typeof pesoInicial !== 'number' || pesoInicial <= 0) {
        return res.status(400).json({
          error: 'productoId y pesoInicial (> 0) son obligatorios',
        });
      }

      const productoRepo = AppDataSource.getRepository(Producto);
      const unidadRepo = AppDataSource.getRepository(Unidad);
      const usuarioRepo = AppDataSource.getRepository(Usuario);
      const producto = await productoRepo.findOneBy({ id: productoId });

      if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      let usuarioCreador = null;
      if (req.user?.id) {
        usuarioCreador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      const unidad = unidadRepo.create({
        producto,
        pesoInicial,
        pesoActual: pesoInicial,
        activa: true,
        observacionesIngreso: observacionesIngreso || null,
        creadoPor: usuarioCreador,
        motivo,
      });

      await unidadRepo.save(unidad);

      const unidadCompleta = await unidadRepo.findOne({
        where: { id: unidad.id },
        relations: ['producto', 'creadoPor'],
      });

      res.status(201).json(unidadCompleta);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getAll(_req: AuthRequest, res: Response) {
    try {
      const unidadRepo = AppDataSource.getRepository(Unidad);
      const unidades = await unidadRepo.find({
        where: { activa: true },
        relations: ['producto', 'producto.tipoQueso', 'particiones', 'creadoPor', 'modificadoPor'],
        order: { createdAt: 'DESC' },
      });

      res.json(unidades);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Reconstruye el stock de quesos que existía en una fecha de corte (por defecto,
   * el lunes más reciente), desglosado producto por producto. Para cada unidad calcula
   * el peso que tenía en esa fecha (peso inicial menos los cortes hechos hasta el corte)
   * y la cuenta como "en stock" solo si en ese momento todavía existía, no estaba dada
   * de baja y tenía peso > 0.
   *
   * Además devuelve los movimientos (cortes y bajas) que esas mismas unidades tuvieron
   * DESDE la fecha de corte hasta ahora, para poder ver qué salió/se cortó en la semana.
   */
  static async getStockAlCorte(req: AuthRequest, res: Response) {
    try {
      const fechaParam = typeof req.query.fecha === 'string' ? req.query.fecha : undefined;
      const corte = fechaParam ? new Date(fechaParam) : getUltimoLunes();

      if (Number.isNaN(corte.getTime())) {
        return res.status(400).json({ error: 'Fecha de corte inválida' });
      }

      const ahora = new Date();

      const unidadRepo = AppDataSource.getRepository(Unidad);
      const unidades = await unidadRepo.find({
        relations: ['producto', 'producto.tipoQueso', 'particiones', 'particiones.motivo'],
        withDeleted: true,
      });

      const productos = new Map<
        number,
        { productoId: number; producto: string; plu: string; tipoQueso: string | null; cantidad: number }
      >();

      type Movimiento = {
        tipo: 'corte' | 'baja';
        unidadId: number;
        producto: string;
        tipoQueso: string | null;
        peso: number | null;
        motivo: string | null;
        fecha: string;
        agotoUnidad: boolean;
      };
      const movimientos: Movimiento[] = [];

      let totalUnidades = 0;

      for (const unidad of unidades) {
        // Aún no existía en la fecha de corte.
        if (new Date(unidad.createdAt) > corte) {
          continue;
        }

        // Ya estaba dada de baja antes (o en) la fecha de corte.
        if (unidad.deletedAt && new Date(unidad.deletedAt) <= corte) {
          continue;
        }

        // Peso consumido por cortes realizados hasta la fecha de corte.
        const consumidoHastaCorte = (unidad.particiones || []).reduce((acc, particion) => {
          return new Date(particion.createdAt) <= corte ? acc + Number(particion.peso) : acc;
        }, 0);

        const pesoEnCorte = Number(unidad.pesoInicial) - consumidoHastaCorte;

        // En esa fecha ya estaba agotada (sin peso disponible).
        if (pesoEnCorte <= 0.0001) {
          continue;
        }

        // --- La unidad estaba en stock el lunes: la contamos por producto ---
        totalUnidades += 1;
        const prod = unidad.producto;
        if (prod) {
          const grupo = productos.get(prod.id) || {
            productoId: prod.id,
            producto: prod.nombre,
            plu: prod.plu,
            tipoQueso: prod.tipoQueso?.nombre ?? null,
            cantidad: 0,
          };
          grupo.cantidad += 1;
          productos.set(prod.id, grupo);
        }

        // --- Movimientos de ESTA unidad desde el corte hasta ahora ---
        const nombreProducto = prod?.nombre ?? 'Producto desconocido';
        const nombreTipo = prod?.tipoQueso?.nombre ?? null;

        // Cortes posteriores al corte. Se ordenan por fecha para detectar cuál dejó
        // la unidad agotada (cuando el peso acumulado consumido alcanza el peso inicial).
        const pesoInicial = Number(unidad.pesoInicial);
        let acumulado = consumidoHastaCorte;
        const particionesPosteriores = (unidad.particiones || [])
          .filter((p) => {
            const fp = new Date(p.createdAt);
            return fp > corte && fp <= ahora;
          })
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        for (const particion of particionesPosteriores) {
          acumulado += Number(particion.peso);
          movimientos.push({
            tipo: 'corte',
            unidadId: unidad.id,
            producto: nombreProducto,
            tipoQueso: nombreTipo,
            peso: Number(particion.peso),
            motivo: particion.motivo?.nombre ?? null,
            fecha: new Date(particion.createdAt).toISOString(),
            agotoUnidad: acumulado >= pesoInicial - 0.0001,
          });
        }

        // Baja (eliminación) posterior al corte.
        if (unidad.deletedAt && new Date(unidad.deletedAt) > corte) {
          movimientos.push({
            tipo: 'baja',
            unidadId: unidad.id,
            producto: nombreProducto,
            tipoQueso: nombreTipo,
            peso: null,
            motivo: null,
            fecha: new Date(unidad.deletedAt).toISOString(),
            agotoUnidad: true,
          });
        }
      }

      const productosArr = Array.from(productos.values()).sort((a, b) =>
        a.producto.localeCompare(b.producto, 'es')
      );

      movimientos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

      res.json({
        fechaCorte: corte.toISOString(),
        totalUnidades,
        productos: productosArr,
        movimientos,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getOne(req: AuthRequest, res: Response) {
    try {
      const unidadRepo = AppDataSource.getRepository(Unidad);
      const unidad = await unidadRepo.findOne({
        where: { id: Number(req.params.id) },
        relations: ['producto', 'producto.tipoQueso', 'particiones', 'particiones.motivo', 'creadoPor', 'modificadoPor'],
      });

      if (!unidad) {
        return res.status(404).json({ error: 'Unidad no encontrada' });
      }

      res.json(unidad);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const unidadId = Number(req.params.id);
      const { observacionesIngreso } = req.body;
      const unidadRepo = AppDataSource.getRepository(Unidad);
      const usuarioRepo = AppDataSource.getRepository(Usuario);
      const unidad = await unidadRepo.findOneBy({ id: unidadId });

      if (!unidad) {
        return res.status(404).json({ error: 'Unidad no encontrada' });
      }

      let usuarioModificador = null;
      if (req.user?.id) {
        usuarioModificador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      unidad.observacionesIngreso = observacionesIngreso || null;
      unidad.modificadoPor = usuarioModificador;

      await unidadRepo.save(unidad);

      const unidadCompleta = await unidadRepo.findOne({
        where: { id: unidadId },
        relations: ['producto', 'creadoPor', 'modificadoPor'],
      });

      res.json(unidadCompleta);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      const unidadId = Number(req.params.id);
      const unidadRepo = AppDataSource.getRepository(Unidad);
      const usuarioRepo = AppDataSource.getRepository(Usuario);
      const unidad = await unidadRepo.findOneBy({ id: unidadId });

      if (!unidad) {
        return res.status(404).json({ error: 'Unidad no encontrada' });
      }

      let usuarioEliminador = null;
      if (req.user?.id) {
        usuarioEliminador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      unidad.eliminadoPor = usuarioEliminador;
      await unidadRepo.softRemove(unidad);

      res.json({ message: 'Unidad eliminada exitosamente' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async hardDelete(req: AuthRequest, res: Response) {
    try {
      const unidadId = Number(req.params.id);
      const unidadRepo = AppDataSource.getRepository(Unidad);
      const unidad = await unidadRepo.findOne({
        where: { id: unidadId },
        withDeleted: true,
      });

      if (!unidad) {
        return res.status(404).json({ error: 'Unidad no encontrada' });
      }

      if (!unidad.deletedAt && unidad.activa) {
        return res.status(400).json({
          error: 'No se puede eliminar permanentemente una unidad activa desde el historial',
        });
      }

      await AppDataSource.transaction(async (manager) => {
        await manager
          .createQueryBuilder()
          .delete()
          .from(Particion)
          .where('unidadId = :unidadId', { unidadId })
          .execute();

        await manager
          .createQueryBuilder()
          .delete()
          .from(Unidad)
          .where('id = :unidadId', { unidadId })
          .execute();
      });

      res.json({ message: 'Unidad eliminada permanentemente' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async addParticiones(req: AuthRequest, res: Response) {
    try {
      const unidadId = Number(req.params.id);
      const { peso, observacionesCorte, motivoId } = req.body;

      if (peso === null || peso === undefined || peso < 0) {
        return res.status(400).json({ error: 'El peso debe ser 0 o mayor' });
      }

      const result: AddParticionResult = await AppDataSource.transaction(async (manager): Promise<AddParticionResult> => {
        const unidadRepo = manager.getRepository(Unidad);
        const particionRepo = manager.getRepository(Particion);
        const usuarioRepo = manager.getRepository(Usuario);
        const motivoRepo = manager.getRepository(Motivo);
        const unidad = await unidadRepo.findOne({
          where: { id: unidadId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!unidad || !unidad.activa) {
          return {
            error: {
              status: 404,
              payload: { error: 'Unidad no encontrada o inactiva' },
            },
          } satisfies ControllerErrorResult;
        }

        let motivo = null;
        if (motivoId) {
          motivo = await motivoRepo.findOneBy({ id: motivoId });
          if (!motivo) {
            return {
              error: {
                status: 404,
                payload: { error: 'Motivo no encontrado' },
              },
            } satisfies ControllerErrorResult;
          }
        }

        let usuarioCreador = null;
        if (req.user?.id) {
          usuarioCreador = await usuarioRepo.findOneBy({ id: req.user.id });
        }

        let pesoFinal = peso;

        if (pesoFinal === 0) {
          if (Number(unidad.pesoActual) === 0) {
            return {
              error: {
                status: 400,
                payload: { error: 'La unidad ya esta agotada' },
              },
            } satisfies ControllerErrorResult;
          }
          pesoFinal = Number(unidad.pesoActual);
        }

        if (Number(unidad.pesoActual) < pesoFinal) {
          return {
            error: {
              status: 400,
              payload: { error: 'Peso insuficiente en la unidad' },
            },
          } satisfies ControllerErrorResult;
        }

        const particion = particionRepo.create({
          unidad,
          peso: pesoFinal,
          observacionesCorte: observacionesCorte || null,
          motivo,
          creadoPor: usuarioCreador,
        });

        unidad.pesoActual = Number(unidad.pesoActual) - pesoFinal;

        if (unidad.pesoActual === 0) {
          unidad.activa = false;
        }

        await particionRepo.save(particion);
        await unidadRepo.save(unidad);

        const particionCompleta = await particionRepo.findOne({
          where: { id: particion.id },
          relations: ['motivo', 'creadoPor'],
        });

        return { unidad, particion: particionCompleta };
      });

      if ('error' in result) {
        return res.status(result.error.status).json(result.error.payload);
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

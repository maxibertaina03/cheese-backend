// Los errores inesperados se derivan al errorHandler global vía asyncHandler
// (ver rutas); acá solo se responden los errores de negocio (400/404).
import { Response } from 'express';
import { AppDataSource } from '../../../config/database';
import { Motivo } from '../entities/Motivo';
import { Particion } from '../entities/Particion';
import { Producto } from '../entities/Producto';
import { Unidad } from '../entities/Unidad';
import { AuthRequest } from '../../../middlewares/auth';
import { computeStockAlCorte, getUltimoLunes } from '../services/stockAlCorte.service';
import { getUsuarioActual } from '../../../compartido/utils/usuarioActual';

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

export class UnidadController {
  static async create(req: AuthRequest, res: Response) {
    const { productoId, pesoInicial, observacionesIngreso, motivoId, fechaElaboracion, numeroLote } =
      req.body;

    if (!motivoId) {
      return res.status(400).json({ error: 'El motivo de ingreso es obligatorio' });
    }

    if (!fechaElaboracion) {
      return res.status(400).json({ error: 'La fecha de elaboración es obligatoria' });
    }

    const motivo = await AppDataSource.getRepository(Motivo).findOneBy({ id: motivoId });

    if (!motivo) {
      return res.status(404).json({ error: 'Motivo no encontrado' });
    }

    if (!productoId || typeof pesoInicial !== 'number' || pesoInicial <= 0) {
      return res.status(400).json({
        error: 'productoId y pesoInicial (> 0) son obligatorios',
      });
    }

    const unidadRepo = AppDataSource.getRepository(Unidad);
    const producto = await AppDataSource.getRepository(Producto).findOneBy({ id: productoId });

    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const unidad = unidadRepo.create({
      producto,
      pesoInicial,
      pesoActual: pesoInicial,
      activa: true,
      observacionesIngreso: observacionesIngreso || null,
      fechaElaboracion,
      numeroLote: numeroLote || null,
      creadoPor: await getUsuarioActual(req),
      motivo,
    });

    await unidadRepo.save(unidad);

    const unidadCompleta = await unidadRepo.findOne({
      where: { id: unidad.id },
      relations: ['producto', 'creadoPor'],
    });

    res.status(201).json(unidadCompleta);
  }

  static async getAll(_req: AuthRequest, res: Response) {
    const unidades = await AppDataSource.getRepository(Unidad).find({
      where: { activa: true },
      relations: ['producto', 'producto.tipoQueso', 'particiones', 'creadoPor', 'modificadoPor'],
      order: { createdAt: 'DESC' },
    });

    res.json(unidades);
  }

  /**
   * Reconstruye el stock de quesos que existía en una fecha de corte (por defecto,
   * el lunes más reciente), desglosado producto por producto.
   *
   * Una unidad estaba en stock en la fecha de corte si fue creada antes del corte,
   * no estaba dada de baja en ese momento, y además: o bien sigue activa hoy (su peso
   * solo pudo haber bajado, así que en el corte tenía peso), o bien está agotada pero
   * su último corte ocurrió DESPUÉS de la fecha de corte (se vació más tarde). Se usan
   * estas señales firmes en lugar de restar pesos, que sufre derivas de redondeo.
   *
   * Además devuelve los movimientos (cortes y bajas) que esas mismas unidades tuvieron
   * DESDE la fecha de corte hasta ahora, para poder ver qué salió/se cortó en la semana.
   */
  static async getStockAlCorte(req: AuthRequest, res: Response) {
    const fechaParam = typeof req.query.fecha === 'string' ? req.query.fecha : undefined;
    const corte = fechaParam ? new Date(fechaParam) : getUltimoLunes();

    if (Number.isNaN(corte.getTime())) {
      return res.status(400).json({ error: 'Fecha de corte inválida' });
    }

    const resultado = await computeStockAlCorte(corte);
    res.json(resultado);
  }

  static async getOne(req: AuthRequest, res: Response) {
    const unidad = await AppDataSource.getRepository(Unidad).findOne({
      where: { id: Number(req.params.id) },
      relations: [
        'producto',
        'producto.tipoQueso',
        'particiones',
        'particiones.motivo',
        'creadoPor',
        'modificadoPor',
      ],
    });

    if (!unidad) {
      return res.status(404).json({ error: 'Unidad no encontrada' });
    }

    res.json(unidad);
  }

  static async update(req: AuthRequest, res: Response) {
    const unidadId = Number(req.params.id);
    const { observacionesIngreso } = req.body;
    const unidadRepo = AppDataSource.getRepository(Unidad);
    const unidad = await unidadRepo.findOneBy({ id: unidadId });

    if (!unidad) {
      return res.status(404).json({ error: 'Unidad no encontrada' });
    }

    unidad.observacionesIngreso = observacionesIngreso || null;
    unidad.modificadoPor = await getUsuarioActual(req);

    await unidadRepo.save(unidad);

    const unidadCompleta = await unidadRepo.findOne({
      where: { id: unidadId },
      relations: ['producto', 'creadoPor', 'modificadoPor'],
    });

    res.json(unidadCompleta);
  }

  static async delete(req: AuthRequest, res: Response) {
    const unidadId = Number(req.params.id);
    const unidadRepo = AppDataSource.getRepository(Unidad);
    const unidad = await unidadRepo.findOneBy({ id: unidadId });

    if (!unidad) {
      return res.status(404).json({ error: 'Unidad no encontrada' });
    }

    unidad.eliminadoPor = await getUsuarioActual(req);
    await unidadRepo.softRemove(unidad);

    res.json({ message: 'Unidad eliminada exitosamente' });
  }

  static async hardDelete(req: AuthRequest, res: Response) {
    const unidadId = Number(req.params.id);
    const unidad = await AppDataSource.getRepository(Unidad).findOne({
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
  }

  static async addParticiones(req: AuthRequest, res: Response) {
    const unidadId = Number(req.params.id);
    const { peso, observacionesCorte, motivoId } = req.body;

    if (peso === null || peso === undefined || peso < 0) {
      return res.status(400).json({ error: 'El peso debe ser 0 o mayor' });
    }

    const result: AddParticionResult = await AppDataSource.transaction(
      async (manager): Promise<AddParticionResult> => {
        const unidadRepo = manager.getRepository(Unidad);
        const particionRepo = manager.getRepository(Particion);
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

        const usuarioCreador = await getUsuarioActual(req, manager);

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
      }
    );

    if ('error' in result) {
      return res.status(result.error.status).json(result.error.payload);
    }

    res.json(result);
  }
}

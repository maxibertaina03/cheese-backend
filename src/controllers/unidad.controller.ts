import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Motivo } from '../entities/Motivo';
import { Particion } from '../entities/Particion';
import { Producto } from '../entities/Producto';
import { Unidad } from '../entities/Unidad';
import { Usuario } from '../entities/Usuario';
import { AuthRequest } from '../middlewares/auth';

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

      const unidadRepo = AppDataSource.getRepository(Unidad);
      const particionRepo = AppDataSource.getRepository(Particion);
      const usuarioRepo = AppDataSource.getRepository(Usuario);
      const motivoRepo = AppDataSource.getRepository(Motivo);
      const unidad = await unidadRepo.findOneBy({ id: unidadId });

      if (!unidad || !unidad.activa) {
        return res.status(404).json({ error: 'Unidad no encontrada o inactiva' });
      }

      let motivo = null;
      if (motivoId) {
        motivo = await motivoRepo.findOneBy({ id: motivoId });
        if (!motivo) {
          return res.status(404).json({ error: 'Motivo no encontrado' });
        }
      }

      let usuarioCreador = null;
      if (req.user?.id) {
        usuarioCreador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      let pesoFinal = peso;

      if (pesoFinal === 0) {
        if (Number(unidad.pesoActual) === 0) {
          return res.status(400).json({ error: 'La unidad ya esta agotada' });
        }
        pesoFinal = Number(unidad.pesoActual);
      }

      if (Number(unidad.pesoActual) < pesoFinal) {
        return res.status(400).json({ error: 'Peso insuficiente en la unidad' });
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

      res.json({ unidad, particion: particionCompleta });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

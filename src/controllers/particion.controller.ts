// ============================================
// ARCHIVO: src/controllers/particion.controller.ts (CORREGIDO)
// ============================================
import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Particion } from '../entities/Particion';
import { Motivo } from '../entities/Motivo'; // ✅ Import correcto
import { Usuario } from '../entities/Usuario';
import { AuthRequest } from '../middlewares/auth';

export class ParticionController {

  // GET /api/particiones - Listar todas las particiones
  static async getAll(req: AuthRequest, res: Response) {
    try {
      const particionRepo = AppDataSource.getRepository(Particion);

      const particiones = await particionRepo.find({
        relations: [
          'unidad',
          'unidad.producto',
          'unidad.producto.tipoQueso',
          'motivo',
          'creadoPor',
          'modificadoPor',
        ],
        order: { createdAt: 'DESC' },
      });

      res.json(particiones);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/particiones/:id - Obtener una partición específica
  static async getOne(req: AuthRequest, res: Response) {
    try {
      const particionRepo = AppDataSource.getRepository(Particion);

      const particion = await particionRepo.findOne({
        where: { id: Number(req.params.id) },
        relations: [
          'unidad',
          'unidad.producto',
          'motivo',
          'creadoPor',
          'modificadoPor',
        ],
      });

      if (!particion) {
        return res.status(404).json({ error: 'Partición no encontrada' });
      }

      res.json(particion);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /api/particiones/:id - Actualizar partición
  static async update(req: AuthRequest, res: Response) {
    try {
      const { observacionesCorte, motivoId } = req.body;
      const particionRepo = AppDataSource.getRepository(Particion);
      const motivoRepo = AppDataSource.getRepository(Motivo); // ✅ Uso correcto
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      const particion = await particionRepo.findOne({
        where: { id: Number(req.params.id) },
        relations: ['motivo'],
      });

      if (!particion) {
        return res.status(404).json({ error: 'Partición no encontrada' });
      }

      // Obtener usuario que modifica
      let usuarioModificador = null;
      if (req.user?.id) {
        usuarioModificador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      if (observacionesCorte !== undefined) {
        particion.observacionesCorte = observacionesCorte;
      }

      if (motivoId !== undefined) {
        if (motivoId === null) {
          particion.motivo = null;
        } else {
          const motivo = await motivoRepo.findOneBy({ id: motivoId }); // ✅ Corregido
          if (!motivo) {
            return res.status(404).json({ error: 'Motivo no encontrado' });
          }
          particion.motivo = motivo;
        }
      }

      particion.modificadoPor = usuarioModificador;

      await particionRepo.save(particion);

      const particionCompleta = await particionRepo.findOne({
        where: { id: particion.id },
        relations: ['motivo', 'creadoPor', 'modificadoPor'],
      });

      res.json(particionCompleta);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // DELETE /api/particiones/:id - Soft delete
  static async delete(req: AuthRequest, res: Response) {
    try {
      const particionRepo = AppDataSource.getRepository(Particion);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      const particion = await particionRepo.findOneBy({
        id: Number(req.params.id),
      });

      if (!particion) {
        return res.status(404).json({ error: 'Partición no encontrada' });
      }

      // Obtener usuario que elimina
      let usuarioEliminador = null;
      if (req.user?.id) {
        usuarioEliminador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      particion.eliminadoPor = usuarioEliminador;
      await particionRepo.softRemove(particion);

      res.json({ message: 'Partición eliminada exitosamente' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
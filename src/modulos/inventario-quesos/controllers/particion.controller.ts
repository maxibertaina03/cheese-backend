// ============================================
// ARCHIVO: src/controllers/particion.controller.ts
// ============================================
// Los errores inesperados se derivan al errorHandler global vía asyncHandler
// (ver rutas); acá solo se responden los errores de negocio (400/404).
import { Response } from 'express';
import { AppDataSource } from '../../../config/database';
import { Particion } from '../entities/Particion';
import { Motivo } from '../entities/Motivo';
import { AuthRequest } from '../../../middlewares/auth';
import { getUsuarioActual } from '../../../compartido/utils/usuarioActual';

export class ParticionController {
  // GET /api/particiones - Listar todas las particiones
  static async getAll(_req: AuthRequest, res: Response) {
    const particiones = await AppDataSource.getRepository(Particion).find({
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
  }

  // GET /api/particiones/:id - Obtener una partición específica
  static async getOne(req: AuthRequest, res: Response) {
    const particion = await AppDataSource.getRepository(Particion).findOne({
      where: { id: Number(req.params.id) },
      relations: ['unidad', 'unidad.producto', 'motivo', 'creadoPor', 'modificadoPor'],
    });

    if (!particion) {
      return res.status(404).json({ error: 'Partición no encontrada' });
    }

    res.json(particion);
  }

  // PUT /api/particiones/:id - Actualizar partición
  static async update(req: AuthRequest, res: Response) {
    const { observacionesCorte, motivoId } = req.body;
    const particionRepo = AppDataSource.getRepository(Particion);
    const motivoRepo = AppDataSource.getRepository(Motivo);

    const particion = await particionRepo.findOne({
      where: { id: Number(req.params.id) },
      relations: ['motivo'],
    });

    if (!particion) {
      return res.status(404).json({ error: 'Partición no encontrada' });
    }

    if (observacionesCorte !== undefined) {
      particion.observacionesCorte = observacionesCorte;
    }

    if (motivoId !== undefined) {
      if (motivoId === null) {
        particion.motivo = null;
      } else {
        const motivo = await motivoRepo.findOneBy({ id: motivoId });
        if (!motivo) {
          return res.status(404).json({ error: 'Motivo no encontrado' });
        }
        particion.motivo = motivo;
      }
    }

    particion.modificadoPor = await getUsuarioActual(req);

    await particionRepo.save(particion);

    const particionCompleta = await particionRepo.findOne({
      where: { id: particion.id },
      relations: ['motivo', 'creadoPor', 'modificadoPor'],
    });

    res.json(particionCompleta);
  }

  // DELETE /api/particiones/:id - Soft delete
  static async delete(req: AuthRequest, res: Response) {
    const particionRepo = AppDataSource.getRepository(Particion);

    const particion = await particionRepo.findOneBy({ id: Number(req.params.id) });

    if (!particion) {
      return res.status(404).json({ error: 'Partición no encontrada' });
    }

    particion.eliminadoPor = await getUsuarioActual(req);
    await particionRepo.softRemove(particion);

    res.json({ message: 'Partición eliminada exitosamente' });
  }
}

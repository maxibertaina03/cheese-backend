// ============================================
// ARCHIVO: src/controllers/motivo.controller.ts
// ============================================
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Motivo } from '../entities/Motivo';
import { AuthRequest } from '../middlewares/auth';

export class MotivoController {
  
  // GET /api/motivos - Listar todos los motivos activos
  static async getAll(req: Request, res: Response) {
    try {
      const motivoRepo = AppDataSource.getRepository(Motivo);
      const motivos = await motivoRepo.find({
        where: { activo: true },
        order: { nombre: 'ASC' },
      });
      res.json(motivos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/motivos/:id - Obtener un motivo específico
  static async getOne(req: Request, res: Response) {
    try {
      const motivoRepo = AppDataSource.getRepository(Motivo);
      const motivo = await motivoRepo.findOne({
        where: { id: Number(req.params.id) },
      });

      if (!motivo) {
        return res.status(404).json({ error: 'Motivo no encontrado' });
      }

      res.json(motivo);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/motivos - Crear nuevo motivo (solo admin)
  static async create(req: AuthRequest, res: Response) {
    try {
      const { nombre, descripcion } = req.body;

      if (!nombre) {
        return res.status(400).json({ error: 'El nombre es obligatorio' });
      }

      const motivoRepo = AppDataSource.getRepository(Motivo);

      // Verificar duplicados
      const existe = await motivoRepo.findOne({ where: { nombre } });
      if (existe) {
        return res.status(409).json({ error: 'Ya existe un motivo con ese nombre' });
      }

      const motivo = motivoRepo.create({
        nombre,
        descripcion: descripcion || null,
        activo: true,
      });

      await motivoRepo.save(motivo);
      res.status(201).json(motivo);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /api/motivos/:id - Actualizar motivo (solo admin)
  static async update(req: AuthRequest, res: Response) {
    try {
      const { nombre, descripcion, activo } = req.body;
      const motivoRepo = AppDataSource.getRepository(Motivo);

      const motivo = await motivoRepo.findOne({
        where: { id: Number(req.params.id) },
      });

      if (!motivo) {
        return res.status(404).json({ error: 'Motivo no encontrado' });
      }

      if (nombre) motivo.nombre = nombre;
      if (descripcion !== undefined) motivo.descripcion = descripcion;
      if (activo !== undefined) motivo.activo = activo;

      await motivoRepo.save(motivo);
      res.json(motivo);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // DELETE /api/motivos/:id - Desactivar motivo (soft delete, solo admin)
  static async delete(req: AuthRequest, res: Response) {
    try {
      const motivoRepo = AppDataSource.getRepository(Motivo);
      const motivo = await motivoRepo.findOne({
        where: { id: Number(req.params.id) },
      });

      if (!motivo) {
        return res.status(404).json({ error: 'Motivo no encontrado' });
      }

      // Soft delete: solo desactivar
      motivo.activo = false;
      await motivoRepo.save(motivo);

      res.json({ message: 'Motivo desactivado exitosamente', motivo });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
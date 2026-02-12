// ============================================
// ARCHIVO: src/controllers/elemento.controller.ts (NUEVO)
// ============================================
import { Response } from 'express';
import { Between } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Elemento } from '../entities/Elemento';
import { Motivo } from '../entities/Motivo';
import { Usuario } from '../entities/Usuario';
import { AuthRequest } from '../middlewares/auth';

export class ElementoController {

  // GET /api/elementos - Listar todos los elementos activos
  static async getAll(req: AuthRequest, res: Response) {
    try {
      const elementoRepo = AppDataSource.getRepository(Elemento);
      
      const elementos = await elementoRepo.find({
        where: { activo: true },
        relations: ['motivoEgreso', 'creadoPor', 'modificadoPor'],
        order: { createdAt: 'DESC' },
      });

      res.json(elementos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/elementos/:id - Obtener un elemento específico
  static async getOne(req: AuthRequest, res: Response) {
    try {
      const elementoRepo = AppDataSource.getRepository(Elemento);
      
      const elemento = await elementoRepo.findOne({
        where: { id: Number(req.params.id) },
        relations: ['motivoEgreso', 'creadoPor', 'modificadoPor'],
      });

      if (!elemento) {
        return res.status(404).json({ error: 'Elemento no encontrado' });
      }

      res.json(elemento);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/elementos - Crear nuevo elemento (ingreso)
  static async create(req: AuthRequest, res: Response) {
    try {
      const { descripcion, fechaIngreso, ubicacion } = req.body;

      if (!descripcion || !fechaIngreso) {
        return res.status(400).json({ 
          error: 'La descripción y fecha de ingreso son obligatorias' 
        });
      }

      const elementoRepo = AppDataSource.getRepository(Elemento);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      // Obtener usuario que crea
      let usuarioCreador = null;
      if (req.user?.id) {
        usuarioCreador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      const elemento = elementoRepo.create({
        descripcion,
        fechaIngreso: new Date(fechaIngreso),
        fechaEgreso: null,
        ubicacion: ubicacion || null,
        activo: true,
        motivoEgreso: null,
        creadoPor: usuarioCreador,
      });

      await elementoRepo.save(elemento);

      const elementoCompleto = await elementoRepo.findOne({
        where: { id: elemento.id },
        relations: ['creadoPor'],
      });

      res.status(201).json(elementoCompleto);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /api/elementos/:id - Actualizar elemento (solo descripción o ubicación)
  static async update(req: AuthRequest, res: Response) {
    try {
      const { descripcion, ubicacion } = req.body;
      const elementoRepo = AppDataSource.getRepository(Elemento);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      const elemento = await elementoRepo.findOne({
        where: { id: Number(req.params.id) },
        relations: ['motivoEgreso'],
      });

      if (!elemento) {
        return res.status(404).json({ error: 'Elemento no encontrado' });
      }

      // No permitir editar si ya fue egresado
      if (!elemento.activo) {
        return res.status(400).json({ 
          error: 'No se puede editar un elemento que ya fue egresado' 
        });
      }

      // Obtener usuario que modifica
      let usuarioModificador = null;
      if (req.user?.id) {
        usuarioModificador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      if (descripcion !== undefined) elemento.descripcion = descripcion;
      if (ubicacion !== undefined) elemento.ubicacion = ubicacion;
      elemento.modificadoPor = usuarioModificador;

      await elementoRepo.save(elemento);

      const elementoCompleto = await elementoRepo.findOne({
        where: { id: elemento.id },
        relations: ['motivoEgreso', 'creadoPor', 'modificadoPor'],
      });

      res.json(elementoCompleto);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/elementos/:id/egreso - Registrar egreso del elemento
  static async registrarEgreso(req: AuthRequest, res: Response) {
    try {
      const { fechaEgreso, motivoId } = req.body;
      const elementoRepo = AppDataSource.getRepository(Elemento);
      const motivoRepo = AppDataSource.getRepository(Motivo);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      if (!fechaEgreso || !motivoId) {
        return res.status(400).json({ 
          error: 'La fecha de egreso y el motivo son obligatorios' 
        });
      }

      const elemento = await elementoRepo.findOne({
        where: { id: Number(req.params.id) },
        relations: ['motivoEgreso'],
      });

      if (!elemento) {
        return res.status(404).json({ error: 'Elemento no encontrado' });
      }

      if (!elemento.activo) {
        return res.status(400).json({ 
          error: 'Este elemento ya fue egresado anteriormente' 
        });
      }

      // Verificar que el motivo existe
      const motivo = await motivoRepo.findOneBy({ id: motivoId });
      if (!motivo) {
        return res.status(404).json({ error: 'Motivo no encontrado' });
      }

      // Obtener usuario que modifica
      let usuarioModificador = null;
      if (req.user?.id) {
        usuarioModificador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      elemento.fechaEgreso = new Date(fechaEgreso);
      elemento.motivoEgreso = motivo;
      elemento.activo = false;
      elemento.modificadoPor = usuarioModificador;

      await elementoRepo.save(elemento);

      const elementoCompleto = await elementoRepo.findOne({
        where: { id: elemento.id },
        relations: ['motivoEgreso', 'creadoPor', 'modificadoPor'],
      });

      res.json({
        message: 'Egreso registrado exitosamente',
        elemento: elementoCompleto,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // DELETE /api/elementos/:id - Soft delete
  static async delete(req: AuthRequest, res: Response) {
    try {
      const elementoRepo = AppDataSource.getRepository(Elemento);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      const elemento = await elementoRepo.findOneBy({
        id: Number(req.params.id),
      });

      if (!elemento) {
        return res.status(404).json({ error: 'Elemento no encontrado' });
      }

      // Obtener usuario que elimina
      let usuarioEliminador = null;
      if (req.user?.id) {
        usuarioEliminador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      elemento.eliminadoPor = usuarioEliminador;
      await elementoRepo.softRemove(elemento);

      res.json({ message: 'Elemento eliminado exitosamente' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/elementos/reporte/activos - Reporte de elementos activos
  static async getReporteActivos(req: AuthRequest, res: Response) {
    try {
      const elementoRepo = AppDataSource.getRepository(Elemento);
      
      const elementos = await elementoRepo.find({
        where: { activo: true },
        relations: ['creadoPor'],
        order: { fechaIngreso: 'DESC' },
      });

      const total = elementos.length;
      const porUbicacion = elementos.reduce((acc: any, el) => {
        const ub = el.ubicacion || 'Sin ubicación';
        acc[ub] = (acc[ub] || 0) + 1;
        return acc;
      }, {});

      res.json({
        total,
        porUbicacion,
        elementos,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
  // GET /api/elementos - Listar todos los elementos (activos por defecto, pero puede filtrarse)
  static async getAll(req: AuthRequest, res: Response) {
    try {
      const { activo, fechaInicio, fechaFin } = req.query;
      const elementoRepo = AppDataSource.getRepository(Elemento);
      
      // Construir condiciones de búsqueda
      const where: any = {};
      
      // Filtrar por estado activo/inactivo si se especifica
      if (activo !== undefined && activo !== 'all') {
        where.activo = activo === 'true';
      }
      // Si no se especifica, por defecto mostrar solo activos (compatibilidad)
      else if (activo === undefined) {
        where.activo = true;
      }
      // Si activo es 'all', no se filtra por estado (mostrar todos)
      
      // Filtrar por fecha de ingreso si se especifica
      if (fechaInicio && fechaFin) {
        where.fechaIngreso = Between(
          new Date(fechaInicio as string),
          new Date(fechaFin as string)
        );
      }
      
      const elementos = await elementoRepo.find({
        where,
        relations: ['motivoEgreso', 'creadoPor', 'modificadoPor'],
        order: { createdAt: 'DESC' },
        withDeleted: false, // No incluir eliminados con soft delete
      });

      res.json(elementos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
  // GET /api/elementos/reporte/egresados - Reporte de elementos egresados
  static async getReporteEgresados(req: AuthRequest, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;
      const elementoRepo = AppDataSource.getRepository(Elemento);
      
      const where: any = { activo: false };
      
      if (fechaInicio && fechaFin) {
        where.fechaEgreso = Between(
          new Date(fechaInicio as string),
          new Date(fechaFin as string)
        );
      }

      const elementos = await elementoRepo.find({
        where,
        relations: ['motivoEgreso', 'creadoPor', 'modificadoPor'],
        order: { fechaEgreso: 'DESC' },
      });

      const total = elementos.length;
      const porMotivo = elementos.reduce((acc: any, el) => {
        const mot = el.motivoEgreso?.nombre || 'Sin motivo';
        acc[mot] = (acc[mot] || 0) + 1;
        return acc;
      }, {});

      res.json({
        total,
        porMotivo,
        elementos,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
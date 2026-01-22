// ============================================
// ARCHIVO: src/controllers/tipoQueso.controller.ts (NUEVO)
// ============================================
import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { TipoQueso } from '../entities/TipoQueso';
import { Usuario } from '../entities/Usuario';
import { AuthRequest } from '../middlewares/auth';

export class TipoQuesoController {

  // GET /api/tipos-queso - Listar todos los tipos
  static async getAll(req: AuthRequest, res: Response) {
    try {
      const tipoQuesoRepo = AppDataSource.getRepository(TipoQueso);
      const tipos = await tipoQuesoRepo.find({
        relations: ['creadoPor', 'modificadoPor'],
        order: { nombre: 'ASC' },
      });
      res.json(tipos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/tipos-queso/:id - Obtener un tipo específico
  static async getOne(req: AuthRequest, res: Response) {
    try {
      const tipoQuesoRepo = AppDataSource.getRepository(TipoQueso);
      const tipo = await tipoQuesoRepo.findOne({
        where: { id: Number(req.params.id) },
        relations: ['productos', 'creadoPor', 'modificadoPor'],
      });

      if (!tipo) {
        return res.status(404).json({ error: 'Tipo de queso no encontrado' });
      }

      res.json(tipo);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/tipos-queso - Crear tipo de queso
  static async create(req: AuthRequest, res: Response) {
    try {
      const { nombre } = req.body;

      if (!nombre) {
        return res.status(400).json({
          error: 'El campo nombre es obligatorio',
        });
      }

      const tipoQuesoRepo = AppDataSource.getRepository(TipoQueso);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      // Evitar duplicados
      const existente = await tipoQuesoRepo.findOne({ where: { nombre } });
      if (existente) {
        return res.status(409).json({
          error: 'Ya existe un tipo de queso con ese nombre',
        });
      }

      // 🆕 Obtener usuario que crea
      let usuarioCreador = null;
      if (req.user?.id) {
        usuarioCreador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      const nuevo = tipoQuesoRepo.create({
        nombre,
        creadoPor: usuarioCreador, // 🆕
      });

      await tipoQuesoRepo.save(nuevo);

      const tipoCompleto = await tipoQuesoRepo.findOne({
        where: { id: nuevo.id },
        relations: ['creadoPor'],
      });

      res.status(201).json(tipoCompleto);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Error al crear tipo de queso' });
    }
  }

  // PUT /api/tipos-queso/:id - Actualizar tipo de queso
  static async update(req: AuthRequest, res: Response) {
    try {
      const { nombre } = req.body;
      const tipoQuesoRepo = AppDataSource.getRepository(TipoQueso);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      const tipo = await tipoQuesoRepo.findOneBy({ id: Number(req.params.id) });
      if (!tipo) {
        return res.status(404).json({ error: 'Tipo de queso no encontrado' });
      }

      // Verificar duplicados si se cambia el nombre
      if (nombre && nombre !== tipo.nombre) {
        const existente = await tipoQuesoRepo.findOne({ where: { nombre } });
        if (existente) {
          return res.status(409).json({
            error: 'Ya existe un tipo de queso con ese nombre',
          });
        }
        tipo.nombre = nombre;
      }

      // 🆕 Obtener usuario que modifica
      let usuarioModificador = null;
      if (req.user?.id) {
        usuarioModificador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      tipo.modificadoPor = usuarioModificador; // 🆕

      await tipoQuesoRepo.save(tipo);

      const tipoCompleto = await tipoQuesoRepo.findOne({
        where: { id: tipo.id },
        relations: ['creadoPor', 'modificadoPor'],
      });

      res.json(tipoCompleto);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // DELETE /api/tipos-queso/:id - Soft delete
  static async delete(req: AuthRequest, res: Response) {
    try {
      const tipoQuesoRepo = AppDataSource.getRepository(TipoQueso);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      const tipo = await tipoQuesoRepo.findOne({
        where: { id: Number(req.params.id) },
        relations: ['productos'],
      });

      if (!tipo) {
        return res.status(404).json({ error: 'Tipo de queso no encontrado' });
      }

      // Verificar si tiene productos asociados
      if (tipo.productos && tipo.productos.length > 0) {
        return res.status(400).json({
          error: 'No se puede eliminar un tipo de queso con productos asociados',
        });
      }

      // 🆕 Obtener usuario que elimina
      let usuarioEliminador = null;
      if (req.user?.id) {
        usuarioEliminador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      tipo.eliminadoPor = usuarioEliminador; // 🆕
      await tipoQuesoRepo.softRemove(tipo);

      res.json({ message: 'Tipo de queso eliminado exitosamente' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
// ============================================
// ARCHIVO: src/controllers/tipo-elemento.controller.ts (NUEVO)
// ============================================
import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { TipoElemento } from '../entities/TipoElemento';
import { AuthRequest } from '../middlewares/auth';

export class TipoElementoController {

  static async getAll(req: AuthRequest, res: Response) {
    try {
      const tipoRepo = AppDataSource.getRepository(TipoElemento);
      const tipos = await tipoRepo.find({
        where: { activo: true },
        order: { nombre: 'ASC' },
      });
      res.json(tipos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      const { nombre, unidadMedida, descripcion, categoria, llevaStock } = req.body;

      if (!nombre) {
        return res.status(400).json({ error: 'El nombre es obligatorio' });
      }

      const tipoRepo = AppDataSource.getRepository(TipoElemento);
      
      // Verificar si ya existe
      const existente = await tipoRepo.findOneBy({ nombre });
      if (existente) {
        return res.status(400).json({ error: 'Ya existe un tipo con este nombre' });
      }

      const tipo = tipoRepo.create({
        nombre,
        unidadMedida: unidadMedida || 'unidades',
        descripcion,
        categoria,
        llevaStock: llevaStock !== undefined ? llevaStock : true,
      });

      await tipoRepo.save(tipo);
      res.status(201).json(tipo);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const { nombre, unidadMedida, descripcion, categoria, activo } = req.body;
      const tipoRepo = AppDataSource.getRepository(TipoElemento);

      const tipo = await tipoRepo.findOneBy({ id: Number(req.params.id) });
      if (!tipo) {
        return res.status(404).json({ error: 'Tipo no encontrado' });
      }

      if (nombre && nombre !== tipo.nombre) {
        const existente = await tipoRepo.findOneBy({ nombre });
        if (existente) {
          return res.status(400).json({ error: 'Ya existe un tipo con este nombre' });
        }
        tipo.nombre = nombre;
      }

      if (unidadMedida !== undefined) tipo.unidadMedida = unidadMedida;
      if (descripcion !== undefined) tipo.descripcion = descripcion;
      if (categoria !== undefined) tipo.categoria = categoria;
      if (activo !== undefined) tipo.activo = activo;

      await tipoRepo.save(tipo);
      res.json(tipo);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      const tipoRepo = AppDataSource.getRepository(TipoElemento);
      const tipo = await tipoRepo.findOne({
        where: { id: Number(req.params.id) },
        relations: ['stocks'],
      });

      if (!tipo) {
        return res.status(404).json({ error: 'Tipo no encontrado' });
      }

      // Verificar que no tenga stock asociado
      if (tipo.stocks && tipo.stocks.length > 0) {
        return res.status(400).json({ 
          error: 'No se puede eliminar un tipo con stock asociado' 
        });
      }

      tipo.activo = false;
      await tipoRepo.save(tipo);

      res.json({ message: 'Tipo desactivado exitosamente' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
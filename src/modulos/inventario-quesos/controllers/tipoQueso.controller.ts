// ============================================
// ARCHIVO: src/controllers/tipoQueso.controller.ts
// ============================================
// Los errores inesperados se derivan al errorHandler global vía asyncHandler
// (ver rutas); acá solo se responden los errores de negocio (400/404/409).
import { Response } from 'express';
import { AppDataSource } from '../../../config/database';
import { TipoQueso } from '../entities/TipoQueso';
import { AuthRequest } from '../../../middlewares/auth';
import { getUsuarioActual } from '../../../compartido/utils/usuarioActual';

export class TipoQuesoController {
  // GET /api/tipos-queso - Listar todos los tipos
  static async getAll(_req: AuthRequest, res: Response) {
    const tipos = await AppDataSource.getRepository(TipoQueso).find({
      relations: ['creadoPor', 'modificadoPor'],
      order: { nombre: 'ASC' },
    });
    res.json(tipos);
  }

  // GET /api/tipos-queso/:id - Obtener un tipo específico
  static async getOne(req: AuthRequest, res: Response) {
    const tipo = await AppDataSource.getRepository(TipoQueso).findOne({
      where: { id: Number(req.params.id) },
      relations: ['productos', 'creadoPor', 'modificadoPor'],
    });

    if (!tipo) {
      return res.status(404).json({ error: 'Tipo de queso no encontrado' });
    }

    res.json(tipo);
  }

  // POST /api/tipos-queso - Crear tipo de queso
  static async create(req: AuthRequest, res: Response) {
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El campo nombre es obligatorio' });
    }

    const tipoQuesoRepo = AppDataSource.getRepository(TipoQueso);

    // Evitar duplicados
    const existente = await tipoQuesoRepo.findOne({ where: { nombre } });
    if (existente) {
      return res.status(409).json({ error: 'Ya existe un tipo de queso con ese nombre' });
    }

    const nuevo = tipoQuesoRepo.create({
      nombre,
      creadoPor: await getUsuarioActual(req),
    });

    await tipoQuesoRepo.save(nuevo);

    const tipoCompleto = await tipoQuesoRepo.findOne({
      where: { id: nuevo.id },
      relations: ['creadoPor'],
    });

    res.status(201).json(tipoCompleto);
  }

  // PUT /api/tipos-queso/:id - Actualizar tipo de queso
  static async update(req: AuthRequest, res: Response) {
    const { nombre } = req.body;
    const tipoQuesoRepo = AppDataSource.getRepository(TipoQueso);

    const tipo = await tipoQuesoRepo.findOneBy({ id: Number(req.params.id) });
    if (!tipo) {
      return res.status(404).json({ error: 'Tipo de queso no encontrado' });
    }

    // Verificar duplicados si se cambia el nombre
    if (nombre && nombre !== tipo.nombre) {
      const existente = await tipoQuesoRepo.findOne({ where: { nombre } });
      if (existente) {
        return res.status(409).json({ error: 'Ya existe un tipo de queso con ese nombre' });
      }
      tipo.nombre = nombre;
    }

    tipo.modificadoPor = await getUsuarioActual(req);

    await tipoQuesoRepo.save(tipo);

    const tipoCompleto = await tipoQuesoRepo.findOne({
      where: { id: tipo.id },
      relations: ['creadoPor', 'modificadoPor'],
    });

    res.json(tipoCompleto);
  }

  // DELETE /api/tipos-queso/:id - Soft delete
  static async delete(req: AuthRequest, res: Response) {
    const tipoQuesoRepo = AppDataSource.getRepository(TipoQueso);

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

    tipo.eliminadoPor = await getUsuarioActual(req);
    await tipoQuesoRepo.softRemove(tipo);

    res.json({ message: 'Tipo de queso eliminado exitosamente' });
  }
}

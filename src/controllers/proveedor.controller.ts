// Los errores inesperados se derivan al errorHandler global vía asyncHandler
// (ver rutas); acá solo se responden los errores de negocio (400/404).
import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Indumentaria } from '../entities/Indumentaria';
import { Proveedor } from '../entities/Proveedor';
import { AuthRequest } from '../middlewares/auth';
import { getUsuarioActual } from '../compartido/utils/usuarioActual';

export class ProveedorController {
  static async getAll(_req: AuthRequest, res: Response) {
    const proveedores = await AppDataSource.getRepository(Proveedor).find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });
    res.json(proveedores);
  }

  static async create(req: AuthRequest, res: Response) {
    const { nombre, contacto, telefono, email, direccion, observaciones } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const proveedorRepo = AppDataSource.getRepository(Proveedor);

    const existente = await proveedorRepo.findOneBy({ nombre });
    if (existente) {
      return res.status(400).json({ error: 'Ya existe un proveedor con este nombre' });
    }

    const proveedor = proveedorRepo.create({
      nombre,
      contacto: contacto ?? null,
      telefono: telefono ?? null,
      email: email ?? null,
      direccion: direccion ?? null,
      observaciones: observaciones ?? null,
      creadoPor: await getUsuarioActual(req),
    });

    await proveedorRepo.save(proveedor);
    res.status(201).json(proveedor);
  }

  static async update(req: AuthRequest, res: Response) {
    const { nombre, contacto, telefono, email, direccion, observaciones, activo } = req.body;
    const proveedorRepo = AppDataSource.getRepository(Proveedor);

    const proveedor = await proveedorRepo.findOneBy({ id: Number(req.params.id) });
    if (!proveedor) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    if (nombre && nombre !== proveedor.nombre) {
      const existente = await proveedorRepo.findOneBy({ nombre });
      if (existente) {
        return res.status(400).json({ error: 'Ya existe un proveedor con este nombre' });
      }
      proveedor.nombre = nombre;
    }

    if (contacto !== undefined) proveedor.contacto = contacto;
    if (telefono !== undefined) proveedor.telefono = telefono;
    if (email !== undefined) proveedor.email = email;
    if (direccion !== undefined) proveedor.direccion = direccion;
    if (observaciones !== undefined) proveedor.observaciones = observaciones;
    if (activo !== undefined) proveedor.activo = activo;

    // Solo se toca modificadoPor si el request viene autenticado.
    if (req.user?.id) {
      proveedor.modificadoPor = await getUsuarioActual(req);
    }

    await proveedorRepo.save(proveedor);
    res.json(proveedor);
  }

  static async delete(req: AuthRequest, res: Response) {
    const proveedorRepo = AppDataSource.getRepository(Proveedor);
    const indumentariaRepo = AppDataSource.getRepository(Indumentaria);

    const proveedor = await proveedorRepo.findOneBy({ id: Number(req.params.id) });
    if (!proveedor) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    const asociadas = await indumentariaRepo.count({
      where: { proveedor: { id: proveedor.id }, activo: true },
    });
    if (asociadas > 0) {
      return res.status(400).json({
        error: 'No se puede eliminar un proveedor con indumentaria asociada',
      });
    }

    proveedor.activo = false;
    if (req.user?.id) {
      proveedor.eliminadoPor = await getUsuarioActual(req);
    }
    await proveedorRepo.save(proveedor);

    res.json({ message: 'Proveedor desactivado exitosamente' });
  }
}

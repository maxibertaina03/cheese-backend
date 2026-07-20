import { Response } from 'express';
import { AppDataSource } from '../../../config/database';
import { Cliente } from '../entities/Cliente';
import { AuthRequest } from '../../../middlewares/auth';
import { getUsuarioActual } from '../../../compartido/utils/usuarioActual';

export class ClienteController {
  static async getAll(_req: AuthRequest, res: Response) {
    try {
      const clienteRepo = AppDataSource.getRepository(Cliente);
      const clientes = await clienteRepo.find({
        where: { activo: true },
        order: { nombre: 'ASC' },
      });
      res.json(clientes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      const {
        nombre,
        tipoDocumento,
        numeroDocumento,
        direccion,
        codigoPostal,
        localidad,
        provincia,
        telefono,
        email,
      } = req.body;

      if (!nombre) {
        return res.status(400).json({ error: 'El nombre es obligatorio' });
      }

      const clienteRepo = AppDataSource.getRepository(Cliente);

      const usuarioCreador = await getUsuarioActual(req);

      const cliente = clienteRepo.create({
        nombre,
        tipoDocumento: tipoDocumento === 'CUIT' ? 'CUIT' : 'DNI',
        numeroDocumento: numeroDocumento ?? null,
        direccion: direccion ?? null,
        codigoPostal: codigoPostal ?? null,
        localidad: localidad ?? null,
        provincia: provincia ?? null,
        telefono: telefono ?? null,
        email: email ?? null,
        creadoPor: usuarioCreador,
      });

      await clienteRepo.save(cliente);
      res.status(201).json(cliente);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      const {
        nombre,
        tipoDocumento,
        numeroDocumento,
        direccion,
        codigoPostal,
        localidad,
        provincia,
        telefono,
        email,
        activo,
      } = req.body;
      const clienteRepo = AppDataSource.getRepository(Cliente);

      const cliente = await clienteRepo.findOneBy({ id: Number(req.params.id) });
      if (!cliente) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }

      if (nombre !== undefined) cliente.nombre = nombre;
      if (tipoDocumento !== undefined) cliente.tipoDocumento = tipoDocumento === 'CUIT' ? 'CUIT' : 'DNI';
      if (numeroDocumento !== undefined) cliente.numeroDocumento = numeroDocumento;
      if (direccion !== undefined) cliente.direccion = direccion;
      if (codigoPostal !== undefined) cliente.codigoPostal = codigoPostal;
      if (localidad !== undefined) cliente.localidad = localidad;
      if (provincia !== undefined) cliente.provincia = provincia;
      if (telefono !== undefined) cliente.telefono = telefono;
      if (email !== undefined) cliente.email = email;
      if (activo !== undefined) cliente.activo = activo;

      // Solo se toca modificadoPor si el request viene autenticado.
      if (req.user?.id) {
        cliente.modificadoPor = await getUsuarioActual(req);
      }

      await clienteRepo.save(cliente);
      res.json(cliente);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      const clienteRepo = AppDataSource.getRepository(Cliente);

      const cliente = await clienteRepo.findOneBy({ id: Number(req.params.id) });
      if (!cliente) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }

      cliente.activo = false;
      if (req.user?.id) {
        cliente.eliminadoPor = await getUsuarioActual(req);
      }
      await clienteRepo.save(cliente);

      res.json({ message: 'Cliente desactivado exitosamente' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

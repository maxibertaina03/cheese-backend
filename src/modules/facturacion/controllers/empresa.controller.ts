import { Response } from 'express';
import { AppDataSource } from '../../../config/database';
import { Empresa } from '../entities/Empresa';
import { AuthRequest } from '../../../middlewares/auth';

// La empresa es una configuración única (singleton): siempre se trabaja con la
// primera fila. GET la devuelve (o null si no existe) y PUT hace upsert.
export class EmpresaController {
  static async get(_req: AuthRequest, res: Response) {
    try {
      const empresaRepo = AppDataSource.getRepository(Empresa);
      const empresa = await empresaRepo.findOne({ where: {}, order: { id: 'ASC' } });
      res.json(empresa ?? null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async upsert(req: AuthRequest, res: Response) {
    try {
      const {
        razonSocial,
        cuit,
        direccion,
        codigoPostal,
        localidad,
        provincia,
        telefono,
        email,
        condicionIva,
      } = req.body;

      const empresaRepo = AppDataSource.getRepository(Empresa);
      let empresa = await empresaRepo.findOne({ where: {}, order: { id: 'ASC' } });

      if (!empresa) {
        empresa = empresaRepo.create();
      }

      if (razonSocial !== undefined) empresa.razonSocial = razonSocial;
      if (cuit !== undefined) empresa.cuit = cuit;
      if (direccion !== undefined) empresa.direccion = direccion;
      if (codigoPostal !== undefined) empresa.codigoPostal = codigoPostal;
      if (localidad !== undefined) empresa.localidad = localidad;
      if (provincia !== undefined) empresa.provincia = provincia;
      if (telefono !== undefined) empresa.telefono = telefono;
      if (email !== undefined) empresa.email = email;
      if (condicionIva !== undefined) empresa.condicionIva = condicionIva;

      await empresaRepo.save(empresa);
      res.json(empresa);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

// src/compartido/utils/usuarioActual.ts
//
// Shared kernel: resuelve la entidad Usuario del request autenticado, para los
// campos de auditoría (creadoPor / modificadoPor / eliminadoPor).
//
// Reemplaza el patrón repetido en los controllers:
//   let usuario = null;
//   if (req.user?.id) usuario = await usuarioRepo.findOneBy({ id: req.user.id });
import { EntityManager } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { Usuario } from '../../modulos/identidad/entities/Usuario';
import { AuthRequest } from '../../middlewares/auth';

// Pasar el `manager` cuando se esté dentro de una transacción, para que la
// lectura participe de la misma.
export const getUsuarioActual = async (
  req: AuthRequest,
  manager?: EntityManager
): Promise<Usuario | null> => {
  if (!req.user?.id) {
    return null;
  }

  const repo = manager ? manager.getRepository(Usuario) : AppDataSource.getRepository(Usuario);
  return repo.findOneBy({ id: req.user.id });
};

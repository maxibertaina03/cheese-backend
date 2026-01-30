// src/routes/usuario.routes.ts (corregido)
import { Router } from 'express';
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Usuario } from '../entities/Usuario';
import { auth, requireRole } from '../middlewares/auth';

// Extender la interfaz Request para incluir user con tipos correctos
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        rol: string;
        username?: string;
      };
    }
  }
}

const router = Router();

// GET /api/usuarios - Listar todos (admin only)
router.get('/', auth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const usuarioRepo = AppDataSource.getRepository(Usuario);
    const usuarios = await usuarioRepo.find({
      select: ['id', 'username', 'rol', 'createdAt'] // Excluir password
    });
    res.json(usuarios);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/usuarios/:id - Actualizar rol (admin only)
router.put('/:id', auth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    // ✅ FIX: Asegurar que id sea string
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { rol } = req.body;
    
    if (!rol || (rol !== 'admin' && rol !== 'usuario')) {
      return res.status(400).json({ error: 'Rol inválido' });
    }
    
    const usuarioRepo = AppDataSource.getRepository(Usuario);
    const usuario = await usuarioRepo.findOneBy({ id: parseInt(idParam) });
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // ✅ FIX: Verificar que req.user existe y usar tipado correcto
    if (req.user && usuario.id === req.user.id) {
      return res.status(403).json({ error: 'No puedes cambiar tu propio rol' });
    }
    
    usuario.rol = rol;
    await usuarioRepo.save(usuario);
    
    res.json({ message: 'Usuario actualizado', usuario: { id: usuario.id, username: usuario.username, rol: usuario.rol } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/usuarios/:id - Eliminar usuario (admin only)
router.delete('/:id', auth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    // ✅ FIX: Asegurar que id sea string
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const usuarioRepo = AppDataSource.getRepository(Usuario);
    const usuario = await usuarioRepo.findOneBy({ id: parseInt(idParam) });
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // ✅ FIX: Verificar que req.user existe y usar tipado correcto
    if (req.user && usuario.id === req.user.id) {
      return res.status(403).json({ error: 'No puedes eliminar tu propia cuenta' });
    }
    
    await usuarioRepo.remove(usuario);
    res.json({ message: 'Usuario eliminado' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
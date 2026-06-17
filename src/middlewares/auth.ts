// ============================================
// 2. ARCHIVO: src/middlewares/auth.ts
// ============================================
import { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../config/auth';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    rol: string;
    permisos?: string[];
  };
}

export const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    
    if (!header) {
      return res.status(401).json({ error: 'No autorizado - No hay token' });
    }

    const token = header.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No autorizado - Token inválido' });
    }

    const decoded = verifyAuthToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

export const requireRole = (rol: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    
    if (req.user.rol !== rol) {
      return res.status(403).json({ error: 'Sin permisos suficientes' });
    }

    next();
  };
};

// Permite el acceso si el usuario es admin (acceso total) o si tiene
// alguno de los modulos/secciones indicados en su lista de permisos.
export const requirePermiso = (...modulos: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (req.user.rol === 'admin') {
      return next();
    }

    const permisos = req.user.permisos ?? [];
    const tieneAcceso = modulos.some((modulo) => permisos.includes(modulo));

    if (!tieneAcceso) {
      return res.status(403).json({ error: 'Sin permisos para esta seccion' });
    }

    next();
  };
};

// ============================================
// 2. ARCHIVO: src/middlewares/auth.ts
// ============================================
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'tu_secreto_temporal';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    rol: string;
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

    const decoded = jwt.verify(token, JWT_SECRET) as any;
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

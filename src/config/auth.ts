import { Request } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthTokenPayload {
  id: number;
  rol: 'admin' | 'usuario';
  username?: string;
}

const fallbackSecret = 'tu_secreto_temporal';

export const JWT_SECRET = process.env.JWT_SECRET || fallbackSecret;

export const signAuthToken = (payload: AuthTokenPayload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

export const verifyAuthToken = (token: string) =>
  jwt.verify(token, JWT_SECRET) as AuthTokenPayload;

export const getOptionalAuthUser = (req: Request): AuthTokenPayload | null => {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  const token = header.split(' ')[1];

  if (!token) {
    return null;
  }

  try {
    return verifyAuthToken(token);
  } catch {
    return null;
  }
};

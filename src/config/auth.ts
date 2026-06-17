import { Request } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthTokenPayload {
  id: number;
  rol: 'admin' | 'usuario';
  username?: string;
  permisos?: string[];
}

const developmentFallbackSecret = 'tu_secreto_temporal';
const insecureSecretPlaceholders = new Set([
  '',
  'change_me',
  developmentFallbackSecret,
]);

const resolveJwtSecret = () => {
  const configuredSecret = process.env.JWT_SECRET?.trim() ?? '';

  if (process.env.NODE_ENV === 'production' && insecureSecretPlaceholders.has(configuredSecret)) {
    throw new Error('JWT_SECRET debe configurarse con un valor seguro en produccion');
  }

  return configuredSecret || developmentFallbackSecret;
};

export const JWT_SECRET = resolveJwtSecret();

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

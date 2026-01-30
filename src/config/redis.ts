// src/config/redis.ts
import Redis from 'ioredis';

// Verificar si hay configuración de Redis
const hasRedisConfig = process.env.REDIS_HOST || process.env.REDIS_URL;

// Crear instancia solo si hay configuración, sino crear un mock
let redis: Redis | any;

if (hasRedisConfig) {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: 0,
    lazyConnect: true, // 👈 No conecta automáticamente
    retryStrategy: (times) => {
      if (times > 3) {
        console.log('⚠️ Redis no disponible, continuando sin caché');
        return null; // Deja de reintentar
      }
      return Math.min(times * 50, 2000);
    }
  });

  // Intentar conectar silenciosamente
  redis.connect().catch(() => {
    console.log('⚠️ Redis no conectado - Sistema funcionando sin caché');
  });

} else {
  console.log('ℹ️ No hay REDIS_HOST configurado - Redis deshabilitado');
  
  // Mock de Redis para que no rompa el código
  redis = {
    get: async () => null,
    setex: async () => 'OK',
    del: async () => 0,
    keys: async () => [],
    on: () => {},
    connect: async () => {},
    status: 'close'
  };
}

// Middleware de caché (solo funciona si Redis está conectado)
import { Request, Response, NextFunction } from 'express';

export const cacheMiddleware = (duration: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Si no hay Redis o no está conectado, pasar directo
    if (!hasRedisConfig || redis.status !== 'ready') {
      return next();
    }

    if (req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl}`;

    try {
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }

      const originalJson = res.json.bind(res);
      res.json = (data: any) => {
        redis.setex(key, duration, JSON.stringify(data)).catch(() => {});
        return originalJson(data);
      };

      next();
    } catch (error) {
      next();
    }
  };
};

// Función para invalidar caché (safe)
export const invalidateCache = async (pattern: string) => {
  if (!hasRedisConfig || redis.status !== 'ready') return;
  
  try {
    const keys = await redis.keys(`cache:${pattern}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (e) {
    // Silenciar errores
  }
};

export { redis };
// src/compartido/middlewares/asyncHandler.ts
//
// Shared kernel: envuelve un handler async y deriva cualquier error al
// errorHandler global (utils/logger), que loguea con Winston y responde.
// Evita repetir el mismo try/catch + res.status(500) en cada método de
// controller.
//
// Uso en las rutas:
//   router.get('/', auth, asyncHandler(ProductoController.getAll));
//
// Los errores de negocio se siguen respondiendo explícitamente con su status
// (400/404) dentro del controller; asyncHandler solo cubre los inesperados.
import { NextFunction, Request, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth';

type HandlerAsync = (req: AuthRequest, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncHandler =
  (handler: HandlerAsync) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req as AuthRequest, res, next)).catch(next);
  };

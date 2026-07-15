// ============================================
// ARCHIVO: src/routes/unidad.routes.ts
// ============================================
import { Router } from 'express';
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Unidad } from '../entities/Unidad';
import { UnidadController } from '../controllers/unidad.controller';
import { auth, requirePermiso } from '../middlewares/auth';
import {
  AddParticionDto,
  CreateUnidadDto,
  UnidadIdParamDto,
  UpdateUnidadDto,
} from '../dtos/unidad.dto';
import { validateDto } from '../middlewares/validation.middleware';
import { asyncHandler } from '../compartido/middlewares/asyncHandler';

const router = Router();

// Historial completo: incluye las unidades dadas de baja (withDeleted).
const getHistorial = async (_req: Request, res: Response) => {
  const unidades = await AppDataSource.getRepository(Unidad).find({
    relations: [
      'producto',
      'producto.tipoQueso',
      'particiones',
      'particiones.motivo',
      'creadoPor',
      'modificadoPor',
    ],
    order: { createdAt: 'DESC' },
    withDeleted: true,
  });

  res.json(unidades);
};

// ⚠️ IMPORTANTE: La ruta /historial debe ir ANTES de /:id
router.get('/historial', auth, asyncHandler(getHistorial));

// ⚠️ También debe ir ANTES de /:id para no ser capturada como un id
router.get('/stock-al-corte', auth, asyncHandler(UnidadController.getStockAlCorte));

// Rutas principales
router.get('/', auth, asyncHandler(UnidadController.getAll));
router.get(
  '/:id',
  auth,
  validateDto(UnidadIdParamDto, 'params'),
  asyncHandler(UnidadController.getOne)
);
router.post(
  '/',
  auth,
  requirePermiso('quesos'),
  validateDto(CreateUnidadDto),
  asyncHandler(UnidadController.create)
);
router.put(
  '/:id',
  auth,
  requirePermiso('quesos'),
  validateDto(UnidadIdParamDto, 'params'),
  validateDto(UpdateUnidadDto),
  asyncHandler(UnidadController.update)
);
router.delete(
  '/:id',
  auth,
  requirePermiso('quesos'),
  validateDto(UnidadIdParamDto, 'params'),
  asyncHandler(UnidadController.delete)
);
router.delete(
  '/:id/hard',
  auth,
  requirePermiso('quesos'),
  validateDto(UnidadIdParamDto, 'params'),
  asyncHandler(UnidadController.hardDelete)
);
router.post(
  '/:id/particiones',
  auth,
  requirePermiso('quesos'),
  validateDto(UnidadIdParamDto, 'params'),
  validateDto(AddParticionDto),
  asyncHandler(UnidadController.addParticiones)
);

export default router;

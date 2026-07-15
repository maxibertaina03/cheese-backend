import { Router } from 'express';
import { ElementoController } from '../controllers/elemento.controller';
import {
  CreateElementoDto,
  ElementoIdParamDto,
  MovimientoElementoDto,
  UpdateElementoDto,
} from '../dtos/elemento.dto';
import { auth, requirePermiso } from '../middlewares/auth';
import { validateDto } from '../middlewares/validation.middleware';
import { asyncHandler } from '../compartido/middlewares/asyncHandler';

const router = Router();

router.get('/', auth, asyncHandler(ElementoController.getAll));
router.get('/:id', auth, validateDto(ElementoIdParamDto, 'params'), asyncHandler(ElementoController.getOne));
router.get(
  '/:id/movimientos',
  auth,
  validateDto(ElementoIdParamDto, 'params'),
  asyncHandler(ElementoController.getMovimientos)
);

router.post(
  '/',
  auth,
  requirePermiso('elementos'),
  validateDto(CreateElementoDto),
  asyncHandler(ElementoController.create)
);
router.put(
  '/:id',
  auth,
  requirePermiso('elementos'),
  validateDto(ElementoIdParamDto, 'params'),
  validateDto(UpdateElementoDto),
  asyncHandler(ElementoController.update)
);
router.post(
  '/:id/ingreso',
  auth,
  requirePermiso('elementos'),
  validateDto(ElementoIdParamDto, 'params'),
  validateDto(MovimientoElementoDto),
  asyncHandler(ElementoController.registrarIngreso)
);
router.post(
  '/:id/egreso',
  auth,
  requirePermiso('elementos'),
  validateDto(ElementoIdParamDto, 'params'),
  validateDto(MovimientoElementoDto),
  asyncHandler(ElementoController.registrarEgreso)
);
router.delete(
  '/:id',
  auth,
  requirePermiso('elementos'),
  validateDto(ElementoIdParamDto, 'params'),
  asyncHandler(ElementoController.delete)
);

export default router;

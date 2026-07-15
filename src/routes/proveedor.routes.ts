import { Router } from 'express';
import { ProveedorController } from '../controllers/proveedor.controller';
import { CreateProveedorDto, IdParamDto, UpdateProveedorDto } from '../dtos/proveedor.dto';
import { auth, requirePermiso } from '../middlewares/auth';
import { validateDto } from '../middlewares/validation.middleware';
import { asyncHandler } from '../compartido/middlewares/asyncHandler';

const router = Router();

router.get('/', auth, asyncHandler(ProveedorController.getAll));

router.post(
  '/',
  auth,
  requirePermiso('indumentaria'),
  validateDto(CreateProveedorDto),
  asyncHandler(ProveedorController.create)
);

router.put(
  '/:id',
  auth,
  requirePermiso('indumentaria'),
  validateDto(IdParamDto, 'params'),
  validateDto(UpdateProveedorDto),
  asyncHandler(ProveedorController.update)
);

router.delete(
  '/:id',
  auth,
  requirePermiso('indumentaria'),
  validateDto(IdParamDto, 'params'),
  asyncHandler(ProveedorController.delete)
);

export default router;

import { Router } from 'express';
import { ProveedorController } from '../controllers/proveedor.controller';
import {
  CreateProveedorDto,
  IdParamDto,
  UpdateProveedorDto,
} from '../dtos/proveedor.dto';
import { auth, requirePermiso } from '../middlewares/auth';
import { validateDto } from '../middlewares/validation.middleware';

const router = Router();

router.get('/', auth, ProveedorController.getAll);

router.post('/', auth, requirePermiso('indumentaria'), validateDto(CreateProveedorDto), ProveedorController.create);

router.put(
  '/:id',
  auth,
  requirePermiso('indumentaria'),
  validateDto(IdParamDto, 'params'),
  validateDto(UpdateProveedorDto),
  ProveedorController.update
);

router.delete(
  '/:id',
  auth,
  requirePermiso('indumentaria'),
  validateDto(IdParamDto, 'params'),
  ProveedorController.delete
);

export default router;

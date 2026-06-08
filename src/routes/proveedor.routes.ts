import { Router } from 'express';
import { ProveedorController } from '../controllers/proveedor.controller';
import {
  CreateProveedorDto,
  IdParamDto,
  UpdateProveedorDto,
} from '../dtos/proveedor.dto';
import { auth, requireRole } from '../middlewares/auth';
import { validateDto } from '../middlewares/validation.middleware';

const router = Router();

router.get('/', auth, ProveedorController.getAll);

router.post('/', auth, requireRole('admin'), validateDto(CreateProveedorDto), ProveedorController.create);

router.put(
  '/:id',
  auth,
  requireRole('admin'),
  validateDto(IdParamDto, 'params'),
  validateDto(UpdateProveedorDto),
  ProveedorController.update
);

router.delete(
  '/:id',
  auth,
  requireRole('admin'),
  validateDto(IdParamDto, 'params'),
  ProveedorController.delete
);

export default router;

import { Router } from 'express';
import { ClienteController } from '../controllers/cliente.controller';
import { ClienteIdParamDto, CreateClienteDto, UpdateClienteDto } from '../dtos/cliente.dto';
import { auth, requirePermiso } from '../middlewares/auth';
import { validateDto } from '../middlewares/validation.middleware';

const router = Router();

router.get('/', auth, requirePermiso('facturacion'), ClienteController.getAll);

router.post(
  '/',
  auth,
  requirePermiso('facturacion'),
  validateDto(CreateClienteDto),
  ClienteController.create
);

router.put(
  '/:id',
  auth,
  requirePermiso('facturacion'),
  validateDto(ClienteIdParamDto, 'params'),
  validateDto(UpdateClienteDto),
  ClienteController.update
);

router.delete(
  '/:id',
  auth,
  requirePermiso('facturacion'),
  validateDto(ClienteIdParamDto, 'params'),
  ClienteController.delete
);

export default router;

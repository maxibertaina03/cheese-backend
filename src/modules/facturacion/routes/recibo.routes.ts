import { Router } from 'express';
import { ReciboController } from '../controllers/recibo.controller';
import { CreateReciboDto, ReciboIdParamDto } from '../dtos/recibo.dto';
import { auth, requirePermiso } from '../../../middlewares/auth';
import { validateDto } from '../../../middlewares/validation.middleware';

const router = Router();

router.get('/', auth, requirePermiso('facturacion'), ReciboController.getAll);

router.get(
  '/:id',
  auth,
  requirePermiso('facturacion'),
  validateDto(ReciboIdParamDto, 'params'),
  ReciboController.getOne
);

router.post(
  '/',
  auth,
  requirePermiso('facturacion'),
  validateDto(CreateReciboDto),
  ReciboController.create
);

export default router;

import { Router } from 'express';
import { NotaCreditoController } from '../controllers/nota-credito.controller';
import {
  CreateNotaCreditoDto,
  NotaCreditoIdParamDto,
  NotaPedidoIdParamDto,
} from '../dtos/nota-credito.dto';
import { auth, requirePermiso } from '../../../middlewares/auth';
import { validateDto } from '../../../middlewares/validation.middleware';

const router = Router();

router.get('/', auth, requirePermiso('facturacion'), NotaCreditoController.getAll);

router.get(
  '/nota-para-devolver/:notaPedidoId',
  auth,
  requirePermiso('facturacion'),
  validateDto(NotaPedidoIdParamDto, 'params'),
  NotaCreditoController.getNotaParaDevolver
);

router.get(
  '/:id',
  auth,
  requirePermiso('facturacion'),
  validateDto(NotaCreditoIdParamDto, 'params'),
  NotaCreditoController.getOne
);

router.post(
  '/',
  auth,
  requirePermiso('facturacion'),
  validateDto(CreateNotaCreditoDto),
  NotaCreditoController.create
);

export default router;

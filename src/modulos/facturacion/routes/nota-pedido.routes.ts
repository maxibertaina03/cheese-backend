import { Router } from 'express';
import { NotaPedidoController } from '../controllers/nota-pedido.controller';
import { CreateNotaPedidoDto, NotaPedidoIdParamDto } from '../dtos/nota-pedido.dto';
import { auth, requirePermiso } from '../../../middlewares/auth';
import { validateDto } from '../../../middlewares/validation.middleware';

const router = Router();

router.get('/', auth, requirePermiso('facturacion'), NotaPedidoController.getAll);

router.get(
  '/:id',
  auth,
  requirePermiso('facturacion'),
  validateDto(NotaPedidoIdParamDto, 'params'),
  NotaPedidoController.getOne
);

router.post(
  '/',
  auth,
  requirePermiso('facturacion'),
  validateDto(CreateNotaPedidoDto),
  NotaPedidoController.create
);

export default router;

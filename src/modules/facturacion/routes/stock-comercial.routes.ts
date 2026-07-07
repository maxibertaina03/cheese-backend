import { Router } from 'express';
import { StockComercialController } from '../controllers/stock-comercial.controller';
import { IngresoStockComercialDto, ProductoIdParamDto } from '../dtos/stock-comercial.dto';
import { auth, requirePermiso } from '../../../middlewares/auth';
import { validateDto } from '../../../middlewares/validation.middleware';

const router = Router();

router.get('/', auth, requirePermiso('facturacion'), StockComercialController.getAll);

router.post(
  '/:productoId/ingreso',
  auth,
  requirePermiso('facturacion'),
  validateDto(ProductoIdParamDto, 'params'),
  validateDto(IngresoStockComercialDto),
  StockComercialController.ingreso
);

router.get(
  '/:productoId/movimientos',
  auth,
  requirePermiso('facturacion'),
  validateDto(ProductoIdParamDto, 'params'),
  StockComercialController.getMovimientos
);

export default router;

import { Router } from 'express';
import { StockElementoController } from '../controllers/stock-elemento.controller';
import { TipoElementoController } from '../controllers/tipo-elemento.controller';
import {
  AjusteStockDto,
  CreateStockElementoDto,
  CreateTipoElementoDto,
  EgresoStockDto,
  IdParamDto,
  IngresoStockDto,
  UpdateStockElementoDto,
  UpdateTipoElementoDto,
} from '../dtos/stock-elemento.dto';
import { auth, requirePermiso } from '../middlewares/auth';
import { validateDto } from '../middlewares/validation.middleware';
import { asyncHandler } from '../compartido/middlewares/asyncHandler';

const router = Router();

router.get('/tipos', auth, asyncHandler(TipoElementoController.getAll));
router.post(
  '/tipos',
  auth,
  requirePermiso('elementos'),
  validateDto(CreateTipoElementoDto),
  asyncHandler(TipoElementoController.create)
);
router.put(
  '/tipos/:id',
  auth,
  requirePermiso('elementos'),
  validateDto(IdParamDto, 'params'),
  validateDto(UpdateTipoElementoDto),
  asyncHandler(TipoElementoController.update)
);
router.delete(
  '/tipos/:id',
  auth,
  requirePermiso('elementos'),
  validateDto(IdParamDto, 'params'),
  asyncHandler(TipoElementoController.delete)
);

router.get('/reporte/bajos', auth, asyncHandler(StockElementoController.getStockBajo));

router.get('/', auth, asyncHandler(StockElementoController.getAll));
router.post(
  '/',
  auth,
  requirePermiso('elementos'),
  validateDto(CreateStockElementoDto),
  asyncHandler(StockElementoController.create)
);
router.put(
  '/:id',
  auth,
  requirePermiso('elementos'),
  validateDto(IdParamDto, 'params'),
  validateDto(UpdateStockElementoDto),
  asyncHandler(StockElementoController.update)
);

router.post(
  '/:id/ingreso',
  auth,
  requirePermiso('elementos'),
  validateDto(IdParamDto, 'params'),
  validateDto(IngresoStockDto),
  asyncHandler(StockElementoController.ingresarStock)
);
router.post(
  '/:id/egreso',
  auth,
  requirePermiso('elementos'),
  validateDto(IdParamDto, 'params'),
  validateDto(EgresoStockDto),
  asyncHandler(StockElementoController.egresarStock)
);
router.post(
  '/:id/ajuste',
  auth,
  requirePermiso('elementos'),
  validateDto(IdParamDto, 'params'),
  validateDto(AjusteStockDto),
  asyncHandler(StockElementoController.ajusteStock)
);

router.get(
  '/:id/movimientos',
  auth,
  validateDto(IdParamDto, 'params'),
  asyncHandler(StockElementoController.getMovimientos)
);

export default router;

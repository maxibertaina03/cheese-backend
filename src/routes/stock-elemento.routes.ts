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
import { auth, requireRole } from '../middlewares/auth';
import { validateDto } from '../middlewares/validation.middleware';

const router = Router();

router.get('/tipos', auth, TipoElementoController.getAll);
router.post('/tipos', auth, requireRole('admin'), validateDto(CreateTipoElementoDto), TipoElementoController.create);
router.put(
  '/tipos/:id',
  auth,
  requireRole('admin'),
  validateDto(IdParamDto, 'params'),
  validateDto(UpdateTipoElementoDto),
  TipoElementoController.update
);
router.delete(
  '/tipos/:id',
  auth,
  requireRole('admin'),
  validateDto(IdParamDto, 'params'),
  TipoElementoController.delete
);

router.get('/reporte/bajos', auth, StockElementoController.getStockBajo);

router.get('/', auth, StockElementoController.getAll);
router.post('/', auth, requireRole('admin'), validateDto(CreateStockElementoDto), StockElementoController.create);
router.put(
  '/:id',
  auth,
  requireRole('admin'),
  validateDto(IdParamDto, 'params'),
  validateDto(UpdateStockElementoDto),
  StockElementoController.update
);

router.post(
  '/:id/ingreso',
  auth,
  requireRole('admin'),
  validateDto(IdParamDto, 'params'),
  validateDto(IngresoStockDto),
  StockElementoController.ingresarStock
);
router.post(
  '/:id/egreso',
  auth,
  requireRole('admin'),
  validateDto(IdParamDto, 'params'),
  validateDto(EgresoStockDto),
  StockElementoController.egresarStock
);
router.post(
  '/:id/ajuste',
  auth,
  requireRole('admin'),
  validateDto(IdParamDto, 'params'),
  validateDto(AjusteStockDto),
  StockElementoController.ajusteStock
);

router.get(
  '/:id/movimientos',
  auth,
  validateDto(IdParamDto, 'params'),
  StockElementoController.getMovimientos
);

export default router;

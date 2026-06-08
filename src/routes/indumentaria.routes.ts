import { Router } from 'express';
import { IndumentariaController } from '../controllers/indumentaria.controller';
import {
  AjusteIndumentariaDto,
  CreateIndumentariaDto,
  EgresoIndumentariaDto,
  IdParamDto,
  IngresoIndumentariaDto,
  UpdateIndumentariaDto,
} from '../dtos/indumentaria.dto';
import { auth, requireRole } from '../middlewares/auth';
import { validateDto } from '../middlewares/validation.middleware';

const router = Router();

router.get('/reporte/bajos', auth, IndumentariaController.getStockBajo);

router.get('/', auth, IndumentariaController.getAll);

router.post('/', auth, requireRole('admin'), validateDto(CreateIndumentariaDto), IndumentariaController.create);

router.put(
  '/:id',
  auth,
  requireRole('admin'),
  validateDto(IdParamDto, 'params'),
  validateDto(UpdateIndumentariaDto),
  IndumentariaController.update
);

router.delete(
  '/:id',
  auth,
  requireRole('admin'),
  validateDto(IdParamDto, 'params'),
  IndumentariaController.delete
);

router.post(
  '/:id/ingreso',
  auth,
  requireRole('admin'),
  validateDto(IdParamDto, 'params'),
  validateDto(IngresoIndumentariaDto),
  IndumentariaController.ingresarStock
);

router.post(
  '/:id/egreso',
  auth,
  requireRole('admin'),
  validateDto(IdParamDto, 'params'),
  validateDto(EgresoIndumentariaDto),
  IndumentariaController.egresarStock
);

router.post(
  '/:id/ajuste',
  auth,
  requireRole('admin'),
  validateDto(IdParamDto, 'params'),
  validateDto(AjusteIndumentariaDto),
  IndumentariaController.ajusteStock
);

router.get(
  '/:id/movimientos',
  auth,
  validateDto(IdParamDto, 'params'),
  IndumentariaController.getMovimientos
);

export default router;

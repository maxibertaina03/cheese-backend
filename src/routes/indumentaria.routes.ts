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
import { auth, requirePermiso } from '../middlewares/auth';
import { validateDto } from '../middlewares/validation.middleware';

const router = Router();

router.get('/reporte/bajos', auth, IndumentariaController.getStockBajo);

router.get('/', auth, IndumentariaController.getAll);

router.post('/', auth, requirePermiso('indumentaria'), validateDto(CreateIndumentariaDto), IndumentariaController.create);

router.put(
  '/:id',
  auth,
  requirePermiso('indumentaria'),
  validateDto(IdParamDto, 'params'),
  validateDto(UpdateIndumentariaDto),
  IndumentariaController.update
);

router.delete(
  '/:id',
  auth,
  requirePermiso('indumentaria'),
  validateDto(IdParamDto, 'params'),
  IndumentariaController.delete
);

router.post(
  '/:id/ingreso',
  auth,
  requirePermiso('indumentaria'),
  validateDto(IdParamDto, 'params'),
  validateDto(IngresoIndumentariaDto),
  IndumentariaController.ingresarStock
);

router.post(
  '/:id/egreso',
  auth,
  requirePermiso('indumentaria'),
  validateDto(IdParamDto, 'params'),
  validateDto(EgresoIndumentariaDto),
  IndumentariaController.egresarStock
);

router.post(
  '/:id/ajuste',
  auth,
  requirePermiso('indumentaria'),
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

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
import { asyncHandler } from '../compartido/middlewares/asyncHandler';

const router = Router();

router.get('/reporte/bajos', auth, asyncHandler(IndumentariaController.getStockBajo));

router.get('/', auth, asyncHandler(IndumentariaController.getAll));

router.post(
  '/',
  auth,
  requirePermiso('indumentaria'),
  validateDto(CreateIndumentariaDto),
  asyncHandler(IndumentariaController.create)
);

router.put(
  '/:id',
  auth,
  requirePermiso('indumentaria'),
  validateDto(IdParamDto, 'params'),
  validateDto(UpdateIndumentariaDto),
  asyncHandler(IndumentariaController.update)
);

router.delete(
  '/:id',
  auth,
  requirePermiso('indumentaria'),
  validateDto(IdParamDto, 'params'),
  asyncHandler(IndumentariaController.delete)
);

router.post(
  '/:id/ingreso',
  auth,
  requirePermiso('indumentaria'),
  validateDto(IdParamDto, 'params'),
  validateDto(IngresoIndumentariaDto),
  asyncHandler(IndumentariaController.ingresarStock)
);

router.post(
  '/:id/egreso',
  auth,
  requirePermiso('indumentaria'),
  validateDto(IdParamDto, 'params'),
  validateDto(EgresoIndumentariaDto),
  asyncHandler(IndumentariaController.egresarStock)
);

router.post(
  '/:id/ajuste',
  auth,
  requirePermiso('indumentaria'),
  validateDto(IdParamDto, 'params'),
  validateDto(AjusteIndumentariaDto),
  asyncHandler(IndumentariaController.ajusteStock)
);

router.get(
  '/:id/movimientos',
  auth,
  validateDto(IdParamDto, 'params'),
  asyncHandler(IndumentariaController.getMovimientos)
);

export default router;

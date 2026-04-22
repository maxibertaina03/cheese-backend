import { Router } from 'express';
import { ElementoController } from '../controllers/elemento.controller';
import {
  CreateElementoDto,
  ElementoIdParamDto,
  MovimientoElementoDto,
  UpdateElementoDto,
} from '../dtos/elemento.dto';
import { auth, requireRole } from '../middlewares/auth';
import { validateDto } from '../middlewares/validation.middleware';

const router = Router();

router.get('/', auth, ElementoController.getAll);
router.get('/:id', auth, validateDto(ElementoIdParamDto, 'params'), ElementoController.getOne);
router.get(
  '/:id/movimientos',
  auth,
  validateDto(ElementoIdParamDto, 'params'),
  ElementoController.getMovimientos
);

router.post('/', auth, requireRole('admin'), validateDto(CreateElementoDto), ElementoController.create);
router.put(
  '/:id',
  auth,
  requireRole('admin'),
  validateDto(ElementoIdParamDto, 'params'),
  validateDto(UpdateElementoDto),
  ElementoController.update
);
router.post(
  '/:id/ingreso',
  auth,
  requireRole('admin'),
  validateDto(ElementoIdParamDto, 'params'),
  validateDto(MovimientoElementoDto),
  ElementoController.registrarIngreso
);
router.post(
  '/:id/egreso',
  auth,
  requireRole('admin'),
  validateDto(ElementoIdParamDto, 'params'),
  validateDto(MovimientoElementoDto),
  ElementoController.registrarEgreso
);
router.delete(
  '/:id',
  auth,
  requireRole('admin'),
  validateDto(ElementoIdParamDto, 'params'),
  ElementoController.delete
);

export default router;

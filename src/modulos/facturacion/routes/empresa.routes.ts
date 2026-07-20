import { Router } from 'express';
import { EmpresaController } from '../controllers/empresa.controller';
import { UpsertEmpresaDto } from '../dtos/empresa.dto';
import { auth, requirePermiso } from '../../../middlewares/auth';
import { validateDto } from '../../../middlewares/validation.middleware';

const router = Router();

router.get('/', auth, requirePermiso('facturacion'), EmpresaController.get);

router.put(
  '/',
  auth,
  requirePermiso('facturacion'),
  validateDto(UpsertEmpresaDto),
  EmpresaController.upsert
);

export default router;

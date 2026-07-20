// ============================================
// ARCHIVO: src/routes/tipoQueso.routes.ts
// ============================================
import { Router } from 'express';
import { TipoQuesoController } from '../controllers/tipoQueso.controller';
import { auth, requirePermiso } from '../../../middlewares/auth';
import { asyncHandler } from '../../../compartido/middlewares/asyncHandler';

const router = Router();

router.get('/', auth, asyncHandler(TipoQuesoController.getAll));
router.get('/:id', auth, asyncHandler(TipoQuesoController.getOne));
router.post('/', auth, requirePermiso('quesos'), asyncHandler(TipoQuesoController.create));
router.put('/:id', auth, requirePermiso('quesos'), asyncHandler(TipoQuesoController.update));
router.delete('/:id', auth, requirePermiso('quesos'), asyncHandler(TipoQuesoController.delete));

export default router;

// ============================================
// ARCHIVO: src/routes/particion.routes.ts
// ============================================
import { Router } from 'express';
import { ParticionController } from '../controllers/particion.controller';
import { auth, requirePermiso } from '../middlewares/auth';
import { asyncHandler } from '../compartido/middlewares/asyncHandler';

const router = Router();

router.get('/', auth, asyncHandler(ParticionController.getAll));
router.get('/:id', auth, asyncHandler(ParticionController.getOne));
router.put('/:id', auth, requirePermiso('quesos'), asyncHandler(ParticionController.update));
router.delete('/:id', auth, requirePermiso('quesos'), asyncHandler(ParticionController.delete));

export default router;

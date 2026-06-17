// ============================================
// ARCHIVO: src/routes/particion.routes.ts (ACTUALIZADO)
// ============================================
import { Router } from 'express';
import { ParticionController } from '../controllers/particion.controller';
import { auth, requirePermiso } from '../middlewares/auth';

const router = Router();

router.get('/', auth, ParticionController.getAll);
router.get('/:id', auth, ParticionController.getOne);
router.put('/:id', auth, requirePermiso('quesos'), ParticionController.update);
router.delete('/:id', auth, requirePermiso('quesos'), ParticionController.delete);

export default router;
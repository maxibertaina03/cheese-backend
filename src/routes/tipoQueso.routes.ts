// ============================================
// ARCHIVO: src/routes/tipoQueso.routes.ts (ACTUALIZADO)
// ============================================
import { Router } from 'express';
import { TipoQuesoController } from '../controllers/tipoQueso.controller';
import { auth, requirePermiso } from '../middlewares/auth';

const router = Router();

router.get('/', auth, TipoQuesoController.getAll);
router.get('/:id', auth, TipoQuesoController.getOne);
router.post('/', auth, requirePermiso('quesos'), TipoQuesoController.create);
router.put('/:id', auth, requirePermiso('quesos'), TipoQuesoController.update);
router.delete('/:id', auth, requirePermiso('quesos'), TipoQuesoController.delete);

export default router;

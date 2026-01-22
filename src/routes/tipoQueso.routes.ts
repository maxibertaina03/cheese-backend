// ============================================
// ARCHIVO: src/routes/tipoQueso.routes.ts (ACTUALIZADO)
// ============================================
import { Router } from 'express';
import { TipoQuesoController } from '../controllers/tipoQueso.controller';
import { auth, requireRole } from '../middlewares/auth';

const router = Router();

router.get('/', auth, TipoQuesoController.getAll);
router.get('/:id', auth, TipoQuesoController.getOne);
router.post('/', auth, requireRole('admin'), TipoQuesoController.create);
router.put('/:id', auth, requireRole('admin'), TipoQuesoController.update);
router.delete('/:id', auth, requireRole('admin'), TipoQuesoController.delete);

export default router;

// ============================================
// ARCHIVO: src/routes/motivo.routes.ts (NUEVO)
// ============================================
import { Router } from 'express';
import { MotivoController } from '../controllers/motivo.controller';
import { auth, requireRole } from '../middlewares/auth';

const router = Router();

// Rutas públicas (requieren autenticación pero no admin)
router.get('/', auth, MotivoController.getAll);
router.get('/:id', auth, MotivoController.getOne);

// Rutas admin
router.post('/', auth, requireRole('admin'), MotivoController.create);
router.put('/:id', auth, requireRole('admin'), MotivoController.update);
router.delete('/:id', auth, requireRole('admin'), MotivoController.delete);

export default router;
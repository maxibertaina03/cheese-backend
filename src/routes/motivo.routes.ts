// ============================================
// ARCHIVO: src/routes/motivo.routes.ts
// ============================================
import { Router } from 'express';
import { MotivoController } from '../controllers/motivo.controller';
import { auth, requireRole } from '../middlewares/auth';
import { asyncHandler } from '../compartido/middlewares/asyncHandler';

const router = Router();

// Rutas públicas (requieren autenticación pero no admin)
router.get('/', auth, asyncHandler(MotivoController.getAll));
router.get('/:id', auth, asyncHandler(MotivoController.getOne));

// Rutas admin
router.post('/', auth, requireRole('admin'), asyncHandler(MotivoController.create));
router.put('/:id', auth, requireRole('admin'), asyncHandler(MotivoController.update));
router.delete('/:id', auth, requireRole('admin'), asyncHandler(MotivoController.delete));

export default router;

// ============================================
// ARCHIVO: src/routes/elemento.routes.ts (CORREGIDO)
// ============================================
import { Router } from 'express';
import { ElementoController } from '../controllers/elemento.controller';
import { auth, requireRole } from '../middlewares/auth';

const router = Router();

// Rutas públicas (requieren autenticación)
router.get('/', auth, ElementoController.getAll);
router.get('/:id', auth, ElementoController.getOne);
router.get('/:id/movimientos', auth, ElementoController.getMovimientos);

// Rutas admin (crear, editar, eliminar, movimientos)
router.post('/', auth, requireRole('admin'), ElementoController.create);
router.put('/:id', auth, requireRole('admin'), ElementoController.update);
router.post('/:id/ingreso', auth, requireRole('admin'), ElementoController.registrarIngreso);
router.post('/:id/egreso', auth, requireRole('admin'), ElementoController.registrarEgreso);
router.delete('/:id', auth, requireRole('admin'), ElementoController.delete);

export default router;
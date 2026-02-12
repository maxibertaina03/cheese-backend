// ============================================
// ARCHIVO: src/routes/elemento.routes.ts (NUEVO)
// ============================================
import { Router } from 'express';
import { ElementoController } from '../controllers/elemento.controller';
import { auth, requireRole } from '../middlewares/auth';

const router = Router();

// Rutas públicas (requieren autenticación)
router.get('/', auth, ElementoController.getAll);
router.get('/:id', auth, ElementoController.getOne);

// Reportes
router.get('/reporte/activos', auth, ElementoController.getReporteActivos);
router.get('/reporte/egresados', auth, ElementoController.getReporteEgresados);

// Rutas admin (crear, editar, eliminar)
router.post('/', auth, requireRole('admin'), ElementoController.create);
router.put('/:id', auth, requireRole('admin'), ElementoController.update);
router.post('/:id/egreso', auth, requireRole('admin'), ElementoController.registrarEgreso);
router.delete('/:id', auth, requireRole('admin'), ElementoController.delete);

export default router;
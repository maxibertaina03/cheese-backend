import { Router } from 'express';
import { MantenimientoController } from '../controllers/mantenimiento.controller';
import { auth, requireRole } from '../../../middlewares/auth';

const router = Router();

// Solo admin: borra todas las transacciones de facturación.
router.post('/limpiar-transacciones', auth, requireRole('admin'), MantenimientoController.limpiarTransacciones);

export default router;

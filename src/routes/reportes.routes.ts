// src/routes/reportes.routes.ts
import { Router } from 'express';
import { ReportesController } from '../controllers/reportes.controller';
import { auth } from '../middlewares/auth';

const router = Router();

// Todas las rutas requieren autenticación
router.get('/dashboard', auth, ReportesController.getDashboard);
router.get('/ventas', auth, ReportesController.getVentas);
router.get('/top-productos', auth, ReportesController.getTopProductos);
router.get('/inventario-valorizado', auth, ReportesController.getInventarioValorizado);

export default router;
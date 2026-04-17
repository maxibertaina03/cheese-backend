// src/routes/reportes.routes.ts
import { Router } from 'express';
import { ReportesController } from '../controllers/reportes.controller';
import { TopProductosQueryDto, VentasQueryDto } from '../dtos/reportes.dto';
import { auth } from '../middlewares/auth';
import { validateDto } from '../middlewares/validation.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.get('/dashboard', auth, ReportesController.getDashboard);
router.get('/ventas', auth, validateDto(VentasQueryDto, 'query'), ReportesController.getVentas);
router.get('/top-productos', auth, validateDto(TopProductosQueryDto, 'query'), ReportesController.getTopProductos);
router.get('/inventario-valorizado', auth, ReportesController.getInventarioValorizado);

export default router;

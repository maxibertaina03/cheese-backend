import { Router } from 'express';
import { ReportesController } from '../controllers/reportes.controller';
import {
  DashboardQueryDto,
  ExportReportQueryDto,
  TopProductosQueryDto,
  VentasQueryDto,
} from '../dtos/reportes.dto';
import { auth } from '../middlewares/auth';
import { validateDto } from '../middlewares/validation.middleware';

const router = Router();

router.get('/dashboard', auth, validateDto(DashboardQueryDto, 'query'), ReportesController.getDashboard);
router.get('/ventas', auth, validateDto(VentasQueryDto, 'query'), ReportesController.getVentas);
router.get('/top-productos', auth, validateDto(TopProductosQueryDto, 'query'), ReportesController.getTopProductos);
router.get('/inventario-valorizado', auth, ReportesController.getInventarioValorizado);
router.get('/export/excel', auth, validateDto(ExportReportQueryDto, 'query'), ReportesController.exportExcel);
router.get('/export/pdf', auth, validateDto(ExportReportQueryDto, 'query'), ReportesController.exportPdf);

export default router;

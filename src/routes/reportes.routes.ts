import { Router } from 'express';
import { ReportesController } from '../controllers/reportes.controller';
import {
  DashboardQueryDto,
  ExportHistorialPdfQueryDto,
  ExportInventarioPdfQueryDto,
  ExportReportQueryDto,
  TopProductosQueryDto,
  VentasQueryDto,
} from '../dtos/reportes.dto';
import { auth, requirePermiso } from '../middlewares/auth';
import { validateDto } from '../middlewares/validation.middleware';

const router = Router();

router.get('/dashboard', auth, validateDto(DashboardQueryDto, 'query'), ReportesController.getDashboard.bind(ReportesController));
router.get('/ventas', auth, validateDto(VentasQueryDto, 'query'), ReportesController.getVentas.bind(ReportesController));
router.get('/top-productos', auth, validateDto(TopProductosQueryDto, 'query'), ReportesController.getTopProductos.bind(ReportesController));
router.get('/inventario-valorizado', auth, ReportesController.getInventarioValorizado.bind(ReportesController));
router.get('/export/excel', auth, validateDto(ExportReportQueryDto, 'query'), ReportesController.exportExcel.bind(ReportesController));
router.get('/export/pdf', auth, validateDto(ExportReportQueryDto, 'query'), ReportesController.exportPdf.bind(ReportesController));
router.get(
  '/export/inventario/pdf',
  auth,
  validateDto(ExportInventarioPdfQueryDto, 'query'),
  ReportesController.exportInventarioPdf.bind(ReportesController)
);
router.get(
  '/export/historial/pdf',
  auth,
  validateDto(ExportHistorialPdfQueryDto, 'query'),
  ReportesController.exportHistorialPdf.bind(ReportesController)
);
router.get(
  '/export/stock-lunes/pdf',
  auth,
  ReportesController.exportStockAlCortePdf.bind(ReportesController)
);
router.get(
  '/export/nota-pedido/:id/pdf',
  auth,
  requirePermiso('facturacion'),
  ReportesController.exportNotaPedidoPdf.bind(ReportesController)
);
router.get(
  '/export/recibo/:id/pdf',
  auth,
  requirePermiso('facturacion'),
  ReportesController.exportReciboPdf.bind(ReportesController)
);

// Indumentaria (prendas)
router.get(
  '/indumentaria/dashboard',
  auth,
  validateDto(DashboardQueryDto, 'query'),
  ReportesController.getIndumentariaDashboard.bind(ReportesController)
);
router.get(
  '/indumentaria/export/excel',
  auth,
  validateDto(ExportReportQueryDto, 'query'),
  ReportesController.exportIndumentariaExcel.bind(ReportesController)
);
router.get(
  '/indumentaria/export/pdf',
  auth,
  validateDto(ExportReportQueryDto, 'query'),
  ReportesController.exportIndumentariaPdf.bind(ReportesController)
);

export default router;

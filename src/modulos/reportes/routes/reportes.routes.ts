import { Router } from 'express';
import { QuesosDashboardController } from '../controllers/quesos-dashboard.controller';
import { InventarioPdfController } from '../controllers/inventario-pdf.controller';
import { ComprobantesPdfController } from '../controllers/comprobantes-pdf.controller';
import { IndumentariaReportesController } from '../controllers/indumentaria-reportes.controller';
import {
  DashboardQueryDto,
  ExportHistorialPdfQueryDto,
  ExportInventarioPdfQueryDto,
  ExportReportQueryDto,
  TopProductosQueryDto,
  VentasQueryDto,
} from '../dtos/reportes.dto';
import { auth, requirePermiso } from '../../../middlewares/auth';
import { validateDto } from '../../../middlewares/validation.middleware';

const router = Router();

// Dashboard de quesos / ventas
router.get('/dashboard', auth, validateDto(DashboardQueryDto, 'query'), QuesosDashboardController.getDashboard);
router.get('/ventas', auth, validateDto(VentasQueryDto, 'query'), QuesosDashboardController.getVentas);
router.get('/top-productos', auth, validateDto(TopProductosQueryDto, 'query'), QuesosDashboardController.getTopProductos);
router.get('/inventario-valorizado', auth, QuesosDashboardController.getInventarioValorizado);
router.get('/export/excel', auth, validateDto(ExportReportQueryDto, 'query'), QuesosDashboardController.exportExcel);
router.get('/export/pdf', auth, validateDto(ExportReportQueryDto, 'query'), QuesosDashboardController.exportPdf);

// PDFs de inventario / historial / stock al corte
router.get(
  '/export/inventario/pdf',
  auth,
  validateDto(ExportInventarioPdfQueryDto, 'query'),
  InventarioPdfController.exportInventarioPdf
);
router.get(
  '/export/historial/pdf',
  auth,
  validateDto(ExportHistorialPdfQueryDto, 'query'),
  InventarioPdfController.exportHistorialPdf
);
router.get('/export/stock-lunes/pdf', auth, InventarioPdfController.exportStockAlCortePdf);

// PDFs de comprobantes de facturación
router.get('/export/nota-pedido/:id/pdf', auth, requirePermiso('facturacion'), ComprobantesPdfController.exportNotaPedidoPdf);
router.get('/export/recibo/:id/pdf', auth, requirePermiso('facturacion'), ComprobantesPdfController.exportReciboPdf);
router.get('/export/nota-credito/:id/pdf', auth, requirePermiso('facturacion'), ComprobantesPdfController.exportNotaCreditoPdf);
router.get('/export/facturacion/pdf', auth, requirePermiso('facturacion'), ComprobantesPdfController.exportReporteFacturacionPdf);

// Indumentaria (prendas)
router.get(
  '/indumentaria/dashboard',
  auth,
  validateDto(DashboardQueryDto, 'query'),
  IndumentariaReportesController.getIndumentariaDashboard
);
router.get(
  '/indumentaria/export/excel',
  auth,
  validateDto(ExportReportQueryDto, 'query'),
  IndumentariaReportesController.exportIndumentariaExcel
);
router.get(
  '/indumentaria/export/pdf',
  auth,
  validateDto(ExportReportQueryDto, 'query'),
  IndumentariaReportesController.exportIndumentariaPdf
);

export default router;

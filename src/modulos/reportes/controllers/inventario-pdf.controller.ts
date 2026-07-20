import { Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Brackets, SelectQueryBuilder } from 'typeorm';
import { AppDataSource } from '../../../config/database';
import { Indumentaria } from '../../indumentaria/entities/Indumentaria';
import { MovimientoIndumentaria } from '../../indumentaria/entities/MovimientoIndumentaria';
import { Empresa } from '../../facturacion/entities/Empresa';
import { NotaPedido } from '../../facturacion/entities/NotaPedido';
import { NotaCredito } from '../../facturacion/entities/NotaCredito';
import { Recibo } from '../../facturacion/entities/Recibo';
import { computeReporte } from '../../facturacion/services/reporte-facturacion.service';
import { Particion } from '../../inventario-quesos/entities/Particion';
import { Unidad } from '../../inventario-quesos/entities/Unidad';
import { AuthRequest } from '../../../middlewares/auth';
import { computeStockAlCorte, getUltimoLunes } from '../../inventario-quesos/services/stockAlCorte.service';
import { formatDateLabel } from '../../../compartido/utils/fechas';
import {
  PdfColumn,
  buildPdfBuffer,
  drawPdfFooter,
  drawPdfTableHeader,
  drawReportHeader,
  drawSectionTitle,
  drawSimpleTable,
  drawSummaryCards,
  ensurePdfSpace,
  textOrDash,
  truncateText,
} from '../../../compartido/utils/pdf';
import { RawVenta, RawTopProducto, RawInventario, DashboardVenta, DashboardTopProducto, DashboardInventario, DateRange, DashboardPeriod, DashboardSnapshot, IndumentariaSnapshot, InventarioPdfQuery, HistorialPdfQuery, toNumber, startOfDay, endOfDay, formatVenta, formatTopProducto, formatInventarioActual, formatInventarioValorizado, formatDateParam, formatKg, formatKgLabel, normalizeSearch, parseOptionalRange } from '../reportes-comunes';
import { getInventarioPdfUnidades, getHistorialPdfUnidades, drawInventarioTable, drawHistorialTable } from '../services/inventario-historial.service';

export class InventarioPdfController {
  static async exportInventarioPdf(req: AuthRequest, res: Response) {
    try {
      const filters = req.query as InventarioPdfQuery;
      const unidades = await getInventarioPdfUnidades(filters);
      const totalPeso = unidades.reduce((sum, unidad) => sum + toNumber(unidad.pesoActual), 0);
      const totalEgreso = unidades.reduce(
        (sum, unidad) => sum + toNumber(unidad.pesoInicial) - toNumber(unidad.pesoActual),
        0
      );
      const doc = new PDFDocument({ margin: 35, size: 'A4', layout: 'landscape', bufferPages: true });
      const bufferPromise = buildPdfBuffer(doc);

      drawReportHeader(doc, 'Inventario actual de quesos', 'Las Tres Estrellas');
      drawSummaryCards(doc, [
        { label: 'Unidades', value: String(unidades.length) },
        { label: 'Peso actual', value: formatKgLabel(totalPeso) },
        { label: 'Egreso acumulado', value: formatKgLabel(totalEgreso) },
        { label: 'Filtro', value: truncateText(filters.search || 'Todos', 24) },
      ]);

      drawSectionTitle(doc, 'Detalle');
      drawInventarioTable(doc, unidades);

      drawPdfFooter(doc);
      doc.end();
      const buffer = await bufferPromise;
      const fileSuffix = formatDateParam(new Date());

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="inventario_${fileSuffix}.pdf"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async exportHistorialPdf(req: AuthRequest, res: Response) {
    try {
      const filters = req.query as HistorialPdfQuery;
      const rangeResult = parseOptionalRange({
        fechaInicio: filters.fechaInicio,
        fechaFin: filters.fechaFin,
      });

      if (rangeResult?.error) {
        return res.status(rangeResult.error.status).json(rangeResult.error.payload);
      }

      const unidades = await getHistorialPdfUnidades(filters, rangeResult?.value);
      const totalPeso = unidades.reduce((sum, unidad) => sum + toNumber(unidad.pesoInicial), 0);
      const totalEgreso = unidades.reduce(
        (sum, unidad) => sum + toNumber(unidad.pesoInicial) - toNumber(unidad.pesoActual),
        0
      );
      const totalActivas = unidades.filter((unidad) => unidad.activa && !unidad.deletedAt).length;
      const totalAgotadas = unidades.filter((unidad) => !unidad.activa || unidad.deletedAt).length;
      const totalCortes = unidades.reduce((sum, unidad) => sum + (unidad.particiones?.length ?? 0), 0);
      const doc = new PDFDocument({ margin: 35, size: 'A4', layout: 'landscape', bufferPages: true });
      const bufferPromise = buildPdfBuffer(doc);
      const estadoLabel = filters.estado && filters.estado !== 'todos' ? filters.estado : 'todos';
      const periodoLabel = rangeResult?.value
        ? `${formatDateParam(rangeResult.value.fechaInicio)} a ${formatDateParam(rangeResult.value.fechaFin)}`
        : 'sin rango';

      drawReportHeader(doc, 'Historial de quesos', `Periodo: ${periodoLabel} | Estado: ${estadoLabel}`);
      drawSummaryCards(doc, [
        { label: 'Unidades', value: String(unidades.length) },
        { label: 'Activas', value: String(totalActivas) },
        { label: 'Agotadas', value: String(totalAgotadas) },
        { label: 'Peso inicial', value: formatKgLabel(totalPeso) },
        { label: 'Egreso total', value: formatKgLabel(totalEgreso) },
        { label: 'Cortes', value: String(totalCortes) },
      ]);

      drawSectionTitle(doc, 'Detalle de unidades y cortes');
      drawHistorialTable(doc, unidades);

      drawPdfFooter(doc);
      doc.end();
      const buffer = await bufferPromise;
      const fileSuffix = rangeResult?.value
        ? `${formatDateParam(rangeResult.value.fechaInicio)}_${formatDateParam(rangeResult.value.fechaFin)}`
        : formatDateParam(new Date());

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="historial_${fileSuffix}.pdf"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async exportStockAlCortePdf(req: AuthRequest, res: Response) {
    try {
      const fechaParam = typeof req.query.fecha === 'string' ? req.query.fecha : undefined;
      const corte = fechaParam ? new Date(fechaParam) : getUltimoLunes();

      if (Number.isNaN(corte.getTime())) {
        return res.status(400).json({ error: 'Fecha de corte inválida' });
      }

      const data = await computeStockAlCorte(corte);
      const fechaLabel = formatDateLabel(data.fechaCorte);

      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      const bufferPromise = buildPdfBuffer(doc);

      drawReportHeader(doc, 'Stock al lunes', `Las Tres Estrellas | Stock al ${fechaLabel}`);
      drawSummaryCards(doc, [
        { label: 'Stock físico (hormas)', value: String(data.totalFisico) },
        { label: 'Stock comercial (venta)', value: String(data.totalComercial) },
        { label: 'Productos', value: String(data.productos.length) },
        { label: 'Fecha de corte', value: fechaLabel },
      ]);

      drawSectionTitle(doc, 'Stock por producto');
      drawSimpleTable(
        doc,
        [
          { label: 'Producto', x: 40, width: 230 },
          { label: 'Tipo', x: 270, width: 110 },
          { label: 'Físico', x: 380, width: 85, align: 'right' },
          { label: 'Comercial', x: 465, width: 90, align: 'right' },
        ],
        data.productos.map((row) => [
          row.producto,
          textOrDash(row.tipoQueso),
          String(row.cantidadFisico),
          String(row.cantidadComercial),
        ])
      );

      drawSectionTitle(doc, 'Lo que salió o se cortó desde el lunes');
      drawSimpleTable(
        doc,
        [
          { label: 'Fecha', x: 40, width: 75 },
          { label: 'Producto', x: 115, width: 150 },
          { label: 'Movimiento', x: 265, width: 120 },
          { label: 'Peso', x: 385, width: 70, align: 'right' },
          { label: 'Motivo', x: 455, width: 100 },
        ],
        data.movimientos.map((mov) => {
          const movimientoLabel =
            mov.tipo === 'baja'
              ? 'Dado de baja'
              : mov.agotoUnidad
              ? 'Corte (quedó agotado)'
              : 'Corte';
          return [
            formatDateLabel(mov.fecha),
            `${truncateText(mov.producto, 26)} #${mov.unidadId}`,
            movimientoLabel,
            mov.peso != null ? formatKgLabel(mov.peso) : '-',
            textOrDash(mov.motivo),
          ];
        })
      );

      drawPdfFooter(doc);
      doc.end();
      const buffer = await bufferPromise;
      const fileSuffix = formatDateParam(corte);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="stock_al_lunes_${fileSuffix}.pdf"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

}

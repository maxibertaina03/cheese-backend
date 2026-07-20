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
import { buildIndumentariaSnapshot } from '../services/indumentaria-reportes.service';

export class IndumentariaReportesController {
  static async getIndumentariaDashboard(req: AuthRequest, res: Response) {
    try {
      const rangeResult = parseOptionalRange(req.query as { fechaInicio?: string; fechaFin?: string });

      if (rangeResult?.error) {
        return res.status(rangeResult.error.status).json(rangeResult.error.payload);
      }

      const snapshot = await buildIndumentariaSnapshot(rangeResult?.value);
      res.json(snapshot);
    } catch (error: any) {
      console.error('Error en getIndumentariaDashboard:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async exportIndumentariaExcel(req: AuthRequest, res: Response) {
    try {
      const rangeResult = parseOptionalRange(req.query as { fechaInicio?: string; fechaFin?: string });

      if (rangeResult?.error) {
        return res.status(rangeResult.error.status).json(rangeResult.error.payload);
      }

      const snapshot = await buildIndumentariaSnapshot(rangeResult?.value);
      const workbook = new ExcelJS.Workbook();

      const resumenSheet = workbook.addWorksheet('Resumen');
      resumenSheet.columns = [
        { header: 'Indicador', key: 'indicador', width: 30 },
        { header: 'Valor', key: 'valor', width: 24 },
      ];
      resumenSheet.addRows([
        { indicador: 'Periodo analizado', valor: snapshot.periodo.label },
        { indicador: 'Prendas activas', valor: snapshot.resumen.totalPrendas },
        { indicador: 'Unidades en stock', valor: snapshot.resumen.totalUnidades },
        { indicador: 'Total ingresado (historico)', valor: snapshot.resumen.totalIngresado },
        { indicador: 'Total entregado', valor: snapshot.resumen.totalEntregado },
        { indicador: 'Prendas con stock bajo', valor: snapshot.resumen.prendasStockBajo },
      ]);

      const categoriaSheet = workbook.addWorksheet('Stock por categoria');
      categoriaSheet.columns = [
        { header: 'Categoria', key: 'categoria', width: 26 },
        { header: 'Prendas', key: 'prendas', width: 12 },
        { header: 'Unidades', key: 'unidades', width: 12 },
      ];
      categoriaSheet.addRows(
        snapshot.porCategoria.length
          ? snapshot.porCategoria
          : [{ categoria: 'Sin datos', prendas: 0, unidades: 0 }]
      );

      const proveedorSheet = workbook.addWorksheet('Stock por proveedor');
      proveedorSheet.columns = [
        { header: 'Proveedor', key: 'proveedor', width: 30 },
        { header: 'Prendas', key: 'prendas', width: 12 },
        { header: 'Unidades', key: 'unidades', width: 12 },
      ];
      proveedorSheet.addRows(
        snapshot.porProveedor.length
          ? snapshot.porProveedor
          : [{ proveedor: 'Sin datos', prendas: 0, unidades: 0 }]
      );

      const entregasSheet = workbook.addWorksheet('Entregas por destino');
      entregasSheet.columns = [
        { header: 'Destino (a quien)', key: 'destino', width: 32 },
        { header: 'Unidades entregadas', key: 'cantidad', width: 20 },
        { header: 'N entregas', key: 'entregas', width: 14 },
      ];
      entregasSheet.addRows(
        snapshot.topEntregas.length
          ? snapshot.topEntregas
          : [{ destino: 'Sin entregas', cantidad: 0, entregas: 0 }]
      );

      const prendasSheet = workbook.addWorksheet('Prendas mas entregadas');
      prendasSheet.columns = [
        { header: 'Prenda', key: 'nombre', width: 32 },
        { header: 'Unidades entregadas', key: 'cantidad', width: 20 },
      ];
      prendasSheet.addRows(
        snapshot.topPrendasEntregadas.length
          ? snapshot.topPrendasEntregadas
          : [{ nombre: 'Sin entregas', cantidad: 0 }]
      );

      const stockBajoSheet = workbook.addWorksheet('Stock bajo');
      stockBajoSheet.columns = [
        { header: 'Prenda', key: 'nombre', width: 30 },
        { header: 'Talle', key: 'talle', width: 12 },
        { header: 'Disponible', key: 'cantidadDisponible', width: 14 },
        { header: 'Stock minimo', key: 'stockMinimo', width: 14 },
      ];
      stockBajoSheet.addRows(
        snapshot.stockBajo.length
          ? snapshot.stockBajo.map((prenda) => ({
              nombre: prenda.nombre,
              talle: prenda.talle ?? '-',
              cantidadDisponible: prenda.cantidadDisponible,
              stockMinimo: prenda.stockMinimo,
            }))
          : [{ nombre: 'Sin alertas', talle: '-', cantidadDisponible: 0, stockMinimo: 0 }]
      );

      const movimientosSheet = workbook.addWorksheet('Movimientos por dia');
      movimientosSheet.columns = [
        { header: 'Fecha', key: 'fecha', width: 14 },
        { header: 'Ingresos', key: 'ingresos', width: 12 },
        { header: 'Egresos', key: 'egresos', width: 12 },
      ];
      movimientosSheet.addRows(
        snapshot.movimientosPorDia.length
          ? snapshot.movimientosPorDia
          : [{ fecha: '-', ingresos: 0, egresos: 0 }]
      );

      const buffer = await workbook.xlsx.writeBuffer();
      const fileSuffix = rangeResult?.value
        ? `${formatDateParam(rangeResult.value.fechaInicio)}_${formatDateParam(rangeResult.value.fechaFin)}`
        : 'historico';

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="reporte_indumentaria_${fileSuffix}.xlsx"`);
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async exportIndumentariaPdf(req: AuthRequest, res: Response) {
    try {
      const rangeResult = parseOptionalRange(req.query as { fechaInicio?: string; fechaFin?: string });

      if (rangeResult?.error) {
        return res.status(rangeResult.error.status).json(rangeResult.error.payload);
      }

      const snapshot = await buildIndumentariaSnapshot(rangeResult?.value);
      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      const bufferPromise = buildPdfBuffer(doc);

      drawReportHeader(doc, 'Reporte de indumentaria', `Periodo: ${snapshot.periodo.label}`);
      drawSummaryCards(doc, [
        { label: 'Prendas', value: String(snapshot.resumen.totalPrendas) },
        { label: 'Unidades stock', value: String(snapshot.resumen.totalUnidades) },
        { label: 'Ingresado', value: String(snapshot.resumen.totalIngresado) },
        { label: 'Entregado', value: String(snapshot.resumen.totalEntregado) },
        { label: 'Stock bajo', value: String(snapshot.resumen.prendasStockBajo) },
      ]);

      drawSectionTitle(doc, 'Stock por categoria');
      drawSimpleTable(
        doc,
        [
          { label: 'Categoria', x: 40, width: 260 },
          { label: 'Prendas', x: 300, width: 120, align: 'right' },
          { label: 'Unidades', x: 420, width: 135, align: 'right' },
        ],
        snapshot.porCategoria.map((row) => [row.categoria, String(row.prendas), String(row.unidades)])
      );

      drawSectionTitle(doc, 'Entregas por destino (a quien se entrego)');
      drawSimpleTable(
        doc,
        [
          { label: 'Destino', x: 40, width: 280 },
          { label: 'Unidades', x: 320, width: 120, align: 'right' },
          { label: 'Entregas', x: 445, width: 110, align: 'right' },
        ],
        snapshot.topEntregas.map((row) => [row.destino, String(row.cantidad), String(row.entregas)])
      );

      drawSectionTitle(doc, 'Prendas mas entregadas');
      drawSimpleTable(
        doc,
        [
          { label: 'Prenda', x: 40, width: 360 },
          { label: 'Unidades entregadas', x: 400, width: 155, align: 'right' },
        ],
        snapshot.topPrendasEntregadas.map((row) => [row.nombre, String(row.cantidad)])
      );

      drawSectionTitle(doc, 'Stock por proveedor');
      drawSimpleTable(
        doc,
        [
          { label: 'Proveedor', x: 40, width: 260 },
          { label: 'Prendas', x: 300, width: 120, align: 'right' },
          { label: 'Unidades', x: 420, width: 135, align: 'right' },
        ],
        snapshot.porProveedor.map((row) => [row.proveedor, String(row.prendas), String(row.unidades)])
      );

      drawSectionTitle(doc, 'Prendas con stock bajo');
      drawSimpleTable(
        doc,
        [
          { label: 'Prenda', x: 40, width: 200 },
          { label: 'Talle', x: 240, width: 90 },
          { label: 'Disponible', x: 330, width: 110, align: 'right' },
          { label: 'Stock minimo', x: 440, width: 115, align: 'right' },
        ],
        snapshot.stockBajo.map((row) => [
          row.nombre,
          textOrDash(row.talle),
          String(row.cantidadDisponible),
          String(row.stockMinimo),
        ])
      );

      drawPdfFooter(doc);
      doc.end();
      const buffer = await bufferPromise;
      const fileSuffix = rangeResult?.value
        ? `${formatDateParam(rangeResult.value.fechaInicio)}_${formatDateParam(rangeResult.value.fechaFin)}`
        : 'historico';

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="reporte_indumentaria_${fileSuffix}.pdf"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

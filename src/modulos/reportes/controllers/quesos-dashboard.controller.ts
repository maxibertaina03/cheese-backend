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
import { getVentasPorPeriodo, getTopProductosRows, getInventarioValorizadoRows, buildDashboardSnapshot, buildResumenExportable } from '../services/quesos-dashboard.service';

export class QuesosDashboardController {
  static async getDashboard(req: AuthRequest, res: Response) {
    try {
      const rangeResult = parseOptionalRange(req.query as { fechaInicio?: string; fechaFin?: string });

      if (rangeResult?.error) {
        return res.status(rangeResult.error.status).json(rangeResult.error.payload);
      }

      const snapshot = await buildDashboardSnapshot(rangeResult?.value);
      res.json(snapshot);
    } catch (error: any) {
      console.error('Error en getDashboard:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getVentas(req: AuthRequest, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query as { fechaInicio: string; fechaFin: string };
      const range: DateRange = {
        fechaInicio: startOfDay(new Date(fechaInicio)),
        fechaFin: endOfDay(new Date(fechaFin)),
      };

      if (range.fechaInicio > range.fechaFin) {
        return res.status(400).json({
          error: 'El rango de fechas es invalido',
          details: 'fechaInicio no puede ser mayor a fechaFin',
        });
      }

      const particionRepo = AppDataSource.getRepository(Particion);
      const ventas = await particionRepo
        .createQueryBuilder('particion')
        .leftJoin('particion.unidad', 'unidad')
        .leftJoin('unidad.producto', 'producto')
        .leftJoin('particion.motivo', 'motivo')
        .select('DATE(particion.createdAt)', 'fecha')
        .addSelect('producto.nombre', 'producto')
        .addSelect('SUM(particion.peso)', 'totalPeso')
        .addSelect('COUNT(particion.id)', 'cantidadCortes')
        .addSelect('motivo.nombre', 'motivo')
        .where('particion.createdAt BETWEEN :fechaInicio AND :fechaFin', range)
        .groupBy('DATE(particion.createdAt)')
        .addGroupBy('producto.nombre')
        .addGroupBy('motivo.nombre')
        .orderBy('DATE(particion.createdAt)', 'ASC')
        .addOrderBy('producto.nombre', 'ASC')
        .getRawMany<RawVenta>();

      res.json(ventas.map(formatVenta));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getTopProductos(req: AuthRequest, res: Response) {
    try {
      const { limit = 10, fechaInicio, fechaFin } = req.query as {
        limit?: number;
        fechaInicio?: string;
        fechaFin?: string;
      };
      const rangeResult = parseOptionalRange({ fechaInicio, fechaFin });

      if (rangeResult?.error) {
        return res.status(rangeResult.error.status).json(rangeResult.error.payload);
      }

      const topProductos = await getTopProductosRows(limit, rangeResult?.value);
      res.json(topProductos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getInventarioValorizado(_req: AuthRequest, res: Response) {
    try {
      const inventario = await getInventarioValorizadoRows();
      res.json(inventario);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async exportExcel(req: AuthRequest, res: Response) {
    try {
      const rangeResult = parseOptionalRange(req.query as { fechaInicio?: string; fechaFin?: string });

      if (rangeResult?.error) {
        return res.status(rangeResult.error.status).json(rangeResult.error.payload);
      }

      const snapshot = await buildDashboardSnapshot(rangeResult?.value);
      const resumen = buildResumenExportable(snapshot, rangeResult?.value);
      const workbook = new ExcelJS.Workbook();
      const resumenSheet = workbook.addWorksheet('Resumen');
      resumenSheet.columns = [
        { header: 'Indicador', key: 'indicador', width: 28 },
        { header: 'Valor', key: 'valor', width: 24 },
      ];
      resumenSheet.addRows([
        { indicador: 'Periodo analizado', valor: resumen.labelPeriodo },
        { indicador: 'Unidades en stock', valor: resumen.totalUnidades },
        { indicador: 'Peso total en stock (kg)', valor: formatKg(resumen.totalPesoStock) },
        { indicador: 'Valor del inventario', valor: resumen.valorInventario.toFixed(2) },
        { indicador: 'Cortes del periodo', valor: resumen.totalCortes },
        { indicador: 'Peso vendido (kg)', valor: formatKg(resumen.totalVendido) },
      ]);

      const ventasSheet = workbook.addWorksheet('Ventas');
      ventasSheet.columns = [
        { header: 'Fecha', key: 'fecha', width: 14 },
        { header: 'Producto', key: 'producto', width: 28 },
        { header: 'Peso vendido (kg)', key: 'pesoKg', width: 18 },
        { header: 'Cortes', key: 'cantidadCortes', width: 12 },
      ];
      ventasSheet.addRows(
        resumen.ventas.length
          ? resumen.ventas.map((venta) => ({
              fecha: venta.fecha,
              producto: venta.producto,
              pesoKg: formatKg(venta.totalPeso),
              cantidadCortes: venta.cantidadCortes,
            }))
          : [{ fecha: '-', producto: 'Sin ventas', pesoKg: 0, cantidadCortes: 0 }]
      );

      const topSheet = workbook.addWorksheet('Top productos');
      topSheet.columns = [
        { header: 'Producto', key: 'nombre', width: 28 },
        { header: 'Total vendido (kg)', key: 'totalVendido', width: 20 },
        { header: 'Cantidad cortes', key: 'cantidadCortes', width: 16 },
        { header: 'Promedio por corte (g)', key: 'promedioCorte', width: 22 },
      ];
      topSheet.addRows(
        snapshot.topProductos.length
          ? snapshot.topProductos.map((producto) => ({
              nombre: producto.nombre,
              totalVendido: formatKg(producto.totalVendido),
              cantidadCortes: producto.cantidadCortes,
              promedioCorte: Number(producto.promedioCorte.toFixed(2)),
            }))
          : [{ nombre: 'Sin ventas', totalVendido: 0, cantidadCortes: 0, promedioCorte: 0 }]
      );

      const buffer = await workbook.xlsx.writeBuffer();
      const fileSuffix = rangeResult?.value
        ? `${formatDateParam(rangeResult.value.fechaInicio)}_${formatDateParam(rangeResult.value.fechaFin)}`
        : 'semana';

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="reporte_${fileSuffix}.xlsx"`);
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async exportPdf(req: AuthRequest, res: Response) {
    try {
      const rangeResult = parseOptionalRange(req.query as { fechaInicio?: string; fechaFin?: string });

      if (rangeResult?.error) {
        return res.status(rangeResult.error.status).json(rangeResult.error.payload);
      }

      const snapshot = await buildDashboardSnapshot(rangeResult?.value);
      const resumen = buildResumenExportable(snapshot, rangeResult?.value);
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const bufferPromise = buildPdfBuffer(doc);

      doc.fontSize(20).text('Reporte de stock y ventas');
      doc.moveDown(0.5);
      doc.fontSize(11).text(`Periodo analizado: ${resumen.labelPeriodo}`);
      doc.text(`Unidades en stock: ${resumen.totalUnidades}`);
      doc.text(`Peso total en stock: ${formatKg(resumen.totalPesoStock)} kg`);
      doc.text(`Valor del inventario: $${resumen.valorInventario.toFixed(2)}`);
      doc.text(`Cortes del periodo: ${resumen.totalCortes}`);
      doc.text(`Peso vendido: ${formatKg(resumen.totalVendido)} kg`);

      doc.moveDown();
      doc.fontSize(14).text('Top productos');
      doc.fontSize(10);
      if (snapshot.topProductos.length) {
        snapshot.topProductos.slice(0, 10).forEach((producto, index) => {
          doc.text(
            `${index + 1}. ${producto.nombre} | ${formatKg(producto.totalVendido)} kg | ${producto.cantidadCortes} cortes`
          );
        });
      } else {
        doc.text('Sin ventas registradas para el periodo elegido.');
      }

      doc.moveDown();
      doc.fontSize(14).text('Ventas por fecha');
      doc.fontSize(10);
      if (resumen.ventas.length) {
        resumen.ventas.slice(0, 20).forEach((venta) => {
          doc.text(
            `${venta.fecha} | ${venta.producto} | ${formatKg(venta.totalPeso)} kg | ${venta.cantidadCortes} cortes`
          );
        });
      } else {
        doc.text('Sin movimientos en el rango consultado.');
      }

      doc.end();
      const buffer = await bufferPromise;
      const fileSuffix = rangeResult?.value
        ? `${formatDateParam(rangeResult.value.fechaInicio)}_${formatDateParam(rangeResult.value.fechaFin)}`
        : 'semana';

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="reporte_${fileSuffix}.pdf"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

}

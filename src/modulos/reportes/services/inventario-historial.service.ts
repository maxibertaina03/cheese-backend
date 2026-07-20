// src/modulos/reportes/services/inventario-historial.service.ts
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Brackets, SelectQueryBuilder } from 'typeorm';
import { AppDataSource } from '../../../config/database';
import { Indumentaria } from '../../indumentaria/entities/Indumentaria';
import { MovimientoIndumentaria } from '../../indumentaria/entities/MovimientoIndumentaria';
import { Producto } from '../../inventario-quesos/entities/Producto';
import { Particion } from '../../inventario-quesos/entities/Particion';
import { Unidad } from '../../inventario-quesos/entities/Unidad';
import { formatDateLabel } from '../../../compartido/utils/fechas';
import { PdfColumn, buildPdfBuffer, drawPdfFooter, drawPdfTableHeader, drawReportHeader, drawSectionTitle, drawSimpleTable, drawSummaryCards, ensurePdfSpace, textOrDash, truncateText } from '../../../compartido/utils/pdf';
import { RawVenta, RawTopProducto, RawInventario, DashboardVenta, DashboardTopProducto, DashboardInventario, DateRange, DashboardPeriod, DashboardSnapshot, IndumentariaSnapshot, InventarioPdfQuery, HistorialPdfQuery, toNumber, startOfDay, endOfDay, formatVenta, formatTopProducto, formatInventarioActual, formatInventarioValorizado, formatDateParam, formatKg, formatKgLabel, normalizeSearch, parseOptionalRange } from '../reportes-comunes';

export function applyUnidadSearch(
    query: SelectQueryBuilder<Unidad>,
    search: string,
    searchObservacionesOnly = false
  ) {
    if (!search) {
      return;
    }

    const searchLike = `%${search}%`;
    const rawSearchLike = `%${search}%`;

    if (searchObservacionesOnly) {
      query.andWhere('LOWER(COALESCE(unidad.observacionesIngreso, \'\')) LIKE :searchLike', {
        searchLike,
      });
      return;
    }

    query.andWhere(
      new Brackets((qb) => {
        qb.where('LOWER(producto.nombre) LIKE :searchLike', { searchLike })
          .orWhere('LOWER(producto.plu) LIKE :searchLike', { searchLike })
          .orWhere('CAST(unidad.id AS TEXT) LIKE :rawSearchLike', { rawSearchLike })
          .orWhere('LOWER(COALESCE(unidad.observacionesIngreso, \'\')) LIKE :searchLike', {
            searchLike,
          });
      })
    );
  }

export async function getInventarioPdfUnidades(filters: InventarioPdfQuery) {
    const unidadRepo = AppDataSource.getRepository(Unidad);
    const query = unidadRepo
      .createQueryBuilder('unidad')
      .leftJoinAndSelect('unidad.producto', 'producto')
      .leftJoinAndSelect('producto.tipoQueso', 'tipo')
      .leftJoinAndSelect('unidad.motivo', 'motivo')
      .leftJoinAndSelect('unidad.particiones', 'particion')
      .leftJoinAndSelect('particion.motivo', 'particionMotivo')
      .where('unidad.activa = true')
      .orderBy('unidad.createdAt', 'DESC')
      .addOrderBy('particion.createdAt', 'ASC');

    if (filters.tipoQuesoId) {
      query.andWhere('tipo.id = :tipoQuesoId', { tipoQuesoId: filters.tipoQuesoId });
    }

    applyUnidadSearch(
      query,
      normalizeSearch(filters.search),
      filters.searchObservaciones === 'true'
    );

    return query.getMany();
  }

export async function getHistorialPdfUnidades(filters: HistorialPdfQuery, range?: DateRange) {
    const unidadRepo = AppDataSource.getRepository(Unidad);
    const query = unidadRepo
      .createQueryBuilder('unidad')
      .withDeleted()
      .leftJoinAndSelect('unidad.producto', 'producto')
      .leftJoinAndSelect('producto.tipoQueso', 'tipo')
      .leftJoinAndSelect('unidad.motivo', 'motivo')
      .leftJoinAndSelect('unidad.particiones', 'particion')
      .leftJoinAndSelect('particion.motivo', 'particionMotivo')
      .where('1 = 1')
      .orderBy('unidad.createdAt', 'DESC')
      .addOrderBy('particion.createdAt', 'ASC');

    if (filters.estado === 'activos') {
      query.andWhere('unidad.activa = true');
      query.andWhere('unidad.deletedAt IS NULL');
    }

    if (filters.estado === 'agotados') {
      query.andWhere('(unidad.activa = false OR unidad.deletedAt IS NOT NULL)');
    }

    if (filters.tipoQuesoId) {
      query.andWhere('tipo.id = :tipoQuesoId', { tipoQuesoId: filters.tipoQuesoId });
    }

    if (range) {
      query.andWhere('unidad.createdAt BETWEEN :fechaInicio AND :fechaFin', range);
    }

    applyUnidadSearch(query, normalizeSearch(filters.search));

    return query.getMany();
  }

export function drawInventarioTable(doc: PDFKit.PDFDocument, unidades: Unidad[]) {
    const columns = [
      { label: 'ID', x: 35, width: 38 },
      { label: 'Producto', x: 78, width: 178 },
      { label: 'PLU', x: 262, width: 76 },
      { label: 'Tipo', x: 344, width: 82 },
      { label: 'Inicial', x: 432, width: 66, align: 'right' },
      { label: 'Actual', x: 504, width: 66, align: 'right' },
      { label: 'Egreso', x: 576, width: 66, align: 'right' },
      { label: 'Motivo', x: 650, width: 82 },
      { label: 'Ingreso', x: 738, width: 68 },
    ] as PdfColumn[];

    drawPdfTableHeader(doc, columns);

    if (!unidades.length) {
      doc.font('Helvetica').fontSize(10).text('No hay unidades para los filtros seleccionados.');
      return;
    }

    unidades.forEach((unidad, index) => {
      ensurePdfSpace(doc, 24, () => drawPdfTableHeader(doc, columns));
      const rowY = doc.y;
      const egreso = toNumber(unidad.pesoInicial) - toNumber(unidad.pesoActual);
      const values = [
        `#${unidad.id}`,
        truncateText(unidad.producto?.nombre ?? '-', 34),
        unidad.producto?.plu ?? '-',
        truncateText(unidad.producto?.tipoQueso?.nombre ?? '-', 16),
        formatKgLabel(unidad.pesoInicial),
        formatKgLabel(unidad.pesoActual),
        formatKgLabel(egreso),
        truncateText(textOrDash(unidad.motivo?.nombre), 18),
        formatDateLabel(unidad.createdAt),
      ];

      if (index % 2 === 0) {
        doc.save().rect(doc.page.margins.left, rowY - 3, doc.page.width - doc.page.margins.left - doc.page.margins.right, 21).fill('#f9fafb').restore();
      }

      doc.fillColor('#111827').font('Helvetica').fontSize(7.5);
      columns.forEach((column, index) => {
        doc.text(values[index], column.x, rowY + 2, {
          width: column.width,
          height: 14,
          align: column.align ?? 'left',
        });
      });
      doc.y = rowY + 22;
    });
  }

export function drawHistorialTable(doc: PDFKit.PDFDocument, unidades: Unidad[]) {
    const columns = [
      { label: 'ID', x: 35, width: 38 },
      { label: 'Producto', x: 78, width: 178 },
      { label: 'Estado', x: 262, width: 58 },
      { label: 'Tipo', x: 326, width: 78 },
      { label: 'Inicial', x: 410, width: 66, align: 'right' },
      { label: 'Actual', x: 482, width: 66, align: 'right' },
      { label: 'Egreso', x: 554, width: 66, align: 'right' },
      { label: 'Ingreso', x: 628, width: 70 },
      { label: 'Cortes', x: 708, width: 46, align: 'center' },
    ] as PdfColumn[];

    drawPdfTableHeader(doc, columns);

    if (!unidades.length) {
      doc.font('Helvetica').fontSize(10).text('No hay unidades para los filtros seleccionados.');
      return;
    }

    unidades.forEach((unidad, index) => {
      const cortes = unidad.particiones ?? [];
      const cutLines = cortes.length
        ? cortes
            .slice(0, 4)
            .map(
              (corte, cutIndex) =>
                `${cutIndex + 1}. ${formatDateLabel(corte.createdAt)} | ${formatKgLabel(corte.peso)} | ${textOrDash(corte.motivo?.nombre)}`
            )
        : ['Sin cortes registrados'];
      if (cortes.length > 4) {
        cutLines.push(`+ ${cortes.length - 4} cortes mas`);
      }

      const detailLines = [
        `PLU ${unidad.producto?.plu ?? '-'} | Motivo ingreso: ${textOrDash(unidad.motivo?.nombre)}`,
        unidad.observacionesIngreso ? `Obs ingreso: ${truncateText(unidad.observacionesIngreso, 135)}` : '',
        `Detalle cortes: ${cutLines.join('   ')}`,
      ].filter(Boolean);
      const rowHeight = 25 + detailLines.length * 12;

      ensurePdfSpace(doc, rowHeight, () => drawPdfTableHeader(doc, columns));
      const rowY = doc.y;
      const egreso = toNumber(unidad.pesoInicial) - toNumber(unidad.pesoActual);
      const estado = unidad.deletedAt ? 'Eliminada' : unidad.activa ? 'Activa' : 'Agotada';
      const values = [
        `#${unidad.id}`,
        truncateText(unidad.producto?.nombre ?? '-', 34),
        estado,
        truncateText(unidad.producto?.tipoQueso?.nombre ?? '-', 16),
        formatKgLabel(unidad.pesoInicial),
        formatKgLabel(unidad.pesoActual),
        formatKgLabel(egreso),
        formatDateLabel(unidad.createdAt),
        String(cortes.length),
      ];

      if (index % 2 === 0) {
        doc.save().rect(doc.page.margins.left, rowY - 3, doc.page.width - doc.page.margins.left - doc.page.margins.right, rowHeight - 4).fill('#f9fafb').restore();
      }

      doc.fillColor('#111827').font('Helvetica').fontSize(7.5);
      columns.forEach((column, valueIndex) => {
        doc.text(values[valueIndex], column.x, rowY + 2, {
          width: column.width,
          height: 14,
          align: column.align ?? 'left',
        });
      });

      doc.font('Helvetica').fontSize(7).fillColor('#4b5563');
      let detailY = rowY + 18;
      detailLines.forEach((line) => {
        doc.text(line, 78, detailY, { width: 700, height: 10 });
        detailY += 12;
      });
      doc.fillColor('#000000');
      doc.y = rowY + rowHeight;
    });
  }


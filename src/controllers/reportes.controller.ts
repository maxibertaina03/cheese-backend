import { Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Brackets, SelectQueryBuilder } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Indumentaria } from '../entities/Indumentaria';
import { MovimientoIndumentaria } from '../entities/MovimientoIndumentaria';
import { Empresa } from '../modules/facturacion/entities/Empresa';
import { NotaPedido } from '../modules/facturacion/entities/NotaPedido';
import { NotaCredito } from '../modules/facturacion/entities/NotaCredito';
import { Recibo } from '../modules/facturacion/entities/Recibo';
import { computeReporte } from '../modules/facturacion/services/reporte-facturacion.service';
import { Particion } from '../entities/Particion';
import { Unidad } from '../entities/Unidad';
import { AuthRequest } from '../middlewares/auth';
import { computeStockAlCorte, getUltimoLunes } from '../services/stockAlCorte.service';

type RawVenta = {
  fecha: string;
  producto: string;
  totalPeso: string | number | null;
  cantidadCortes: string | number | null;
  motivo?: string | null;
};

type RawTopProducto = {
  productoId: string | number;
  nombre: string;
  totalVendido: string | number | null;
  cantidadCortes: string | number | null;
  promedioCorte: string | number | null;
};

type RawInventario = {
  cantidad: string | number | null;
  pesoTotal: string | number | null;
  precioKilo?: string | number | null;
  producto?: string | null;
  tipoQueso?: string | null;
  valorTotal?: string | number | null;
};

type DashboardVenta = {
  fecha: string;
  producto: string;
  motivo: string | null;
  totalPeso: number;
  cantidadCortes: number;
};

type DashboardTopProducto = {
  productoId: number;
  nombre: string;
  totalVendido: number;
  cantidadCortes: number;
  promedioCorte: number;
};

type DashboardInventario = {
  cantidad: number;
  pesoTotal: number;
  tipoQueso?: string;
  producto?: string;
  precioKilo?: number;
  valorTotal?: number;
};

type DateRange = {
  fechaInicio: Date;
  fechaFin: Date;
};

type DashboardPeriod = 'hoy' | 'semana' | 'mes';

type DashboardSnapshot = {
  inventarioActual: DashboardInventario[];
  inventarioValorizado: DashboardInventario[];
  topProductos: DashboardTopProducto[];
  ventas: Record<DashboardPeriod, DashboardVenta[]> & {
    personalizado?: DashboardVenta[];
  };
  alertas: unknown[];
  periodoActual: {
    tipo: DashboardPeriod | 'personalizado';
    fechaInicio: string | null;
    fechaFin: string | null;
  };
};

type IndumentariaSnapshot = {
  resumen: {
    totalPrendas: number;
    totalUnidades: number;
    totalIngresado: number;
    totalEntregado: number;
    prendasStockBajo: number;
  };
  porCategoria: { categoria: string; prendas: number; unidades: number }[];
  porProveedor: { proveedor: string; prendas: number; unidades: number }[];
  topEntregas: { destino: string; cantidad: number; entregas: number }[];
  topPrendasEntregadas: { nombre: string; cantidad: number }[];
  movimientosPorDia: { fecha: string; ingresos: number; egresos: number }[];
  stockBajo: {
    id: number;
    nombre: string;
    talle: string | null;
    cantidadDisponible: number;
    stockMinimo: number;
  }[];
  periodo: { fechaInicio: string | null; fechaFin: string | null; label: string };
};

type InventarioPdfQuery = {
  search?: string;
  tipoQuesoId?: number;
  searchObservaciones?: string;
};

type HistorialPdfQuery = InventarioPdfQuery & {
  estado?: 'todos' | 'activos' | 'agotados';
  fechaInicio?: string;
  fechaFin?: string;
};

const toNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  return Number(value);
};

const startOfDay = (date: Date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date: Date) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const formatVenta = (row: RawVenta): DashboardVenta => ({
  fecha: formatDateParam(new Date(row.fecha)),
  producto: row.producto,
  motivo: row.motivo ?? null,
  totalPeso: toNumber(row.totalPeso),
  cantidadCortes: toNumber(row.cantidadCortes),
});

const formatTopProducto = (row: RawTopProducto): DashboardTopProducto => ({
  productoId: Number(row.productoId),
  nombre: row.nombre,
  totalVendido: toNumber(row.totalVendido),
  cantidadCortes: toNumber(row.cantidadCortes),
  promedioCorte: toNumber(row.promedioCorte),
});

const formatInventarioActual = (row: RawInventario): DashboardInventario => ({
  cantidad: toNumber(row.cantidad),
  pesoTotal: toNumber(row.pesoTotal),
  tipoQueso: row.tipoQueso ?? 'Sin tipo',
});

const formatInventarioValorizado = (row: RawInventario): DashboardInventario => ({
  producto: row.producto ?? 'Sin producto',
  cantidad: toNumber(row.cantidad),
  pesoTotal: toNumber(row.pesoTotal),
  precioKilo: toNumber(row.precioKilo),
  valorTotal: toNumber(row.valorTotal),
});

const formatDateParam = (date: Date) => date.toISOString().slice(0, 10);

const formatKg = (grams: number) => Number((grams / 1000).toFixed(2));

const formatKgLabel = (grams: string | number | null | undefined) =>
  `${formatKg(toNumber(grams)).toFixed(2)} kg`;

const formatDateLabel = (date: Date | string | null | undefined) => {
  if (!date) {
    return '-';
  }

  return new Date(date).toLocaleDateString('es-AR');
};

const normalizeSearch = (value: string | undefined) => value?.trim().toLowerCase() ?? '';

const parseOptionalRange = (query: { fechaInicio?: string; fechaFin?: string }) => {
  if (!query.fechaInicio && !query.fechaFin) {
    return null;
  }

  if (!query.fechaInicio || !query.fechaFin) {
    return {
      error: {
        status: 400,
        payload: {
          error: 'El rango de fechas es incompleto',
          details: 'fechaInicio y fechaFin deben enviarse juntos',
        },
      },
    };
  }

  const fechaInicio = startOfDay(new Date(query.fechaInicio));
  const fechaFin = endOfDay(new Date(query.fechaFin));

  if (fechaInicio > fechaFin) {
    return {
      error: {
        status: 400,
        payload: {
          error: 'El rango de fechas es invalido',
          details: 'fechaInicio no puede ser mayor a fechaFin',
        },
      },
    };
  }

  return {
    value: {
      fechaInicio,
      fechaFin,
    },
  };
};

const buildPdfBuffer = (doc: PDFKit.PDFDocument) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

const drawSectionTitle = (doc: PDFKit.PDFDocument, title: string) => {
  doc.moveDown(0.8);
  // Posicionar siempre en el margen izquierdo: si el cursor quedó corrido a la derecha
  // (p. ej. tras dibujar tarjetas), un ancho casi nulo hace que el texto se envuelva mal
  // y PDFKit termine generando páginas en blanco.
  doc.x = doc.page.margins.left;
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(13).text(title, doc.page.margins.left, doc.y);
  doc.moveDown(0.3);
};

const ensurePdfSpace = (doc: PDFKit.PDFDocument, height: number, onNewPage?: () => void) => {
  if (doc.y + height <= doc.page.height - doc.page.margins.bottom) {
    return;
  }

  doc.addPage();
  onNewPage?.();
};

const textOrDash = (value: string | null | undefined) => value?.trim() || '-';

type PdfColumn = {
  label: string;
  x: number;
  width: number;
  align?: 'left' | 'right' | 'center';
};

const truncateText = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}.` : value;

const drawReportHeader = (
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle: string,
  generatedAt = new Date()
) => {
  const { left, right, top } = doc.page.margins;
  const width = doc.page.width - left - right;

  doc.save();
  doc.rect(left, top, width, 46).fill('#111827');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text(title, left + 16, top + 11);
  doc
    .fillColor('#d1d5db')
    .font('Helvetica')
    .fontSize(9)
    .text(subtitle, left + 16, top + 31)
    .text(`Generado: ${formatDateLabel(generatedAt)}`, left + width - 190, top + 18, {
      width: 170,
      align: 'right',
    });
  doc.restore();
  doc.y = top + 62;
};

const drawSummaryCards = (doc: PDFKit.PDFDocument, cards: Array<{ label: string; value: string }>) => {
  const { left, right } = doc.page.margins;
  const gap = 8;
  const width = doc.page.width - left - right;
  const cardWidth = (width - gap * (cards.length - 1)) / cards.length;
  const y = doc.y;

  cards.forEach((card, index) => {
    const x = left + index * (cardWidth + gap);
    doc.save();
    doc.roundedRect(x, y, cardWidth, 38, 4).fill('#f3f4f6');
    doc
      .fillColor('#6b7280')
      .font('Helvetica-Bold')
      .fontSize(7)
      .text(card.label.toUpperCase(), x + 8, y + 7, { width: cardWidth - 16 });
    doc
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(card.value, x + 8, y + 19, { width: cardWidth - 16 });
    doc.restore();
  });

  // Reposicionar el cursor al margen izquierdo (las tarjetas lo dejan corrido a la derecha,
  // lo que puede provocar texto mal envuelto y páginas en blanco en lo que sigue).
  doc.x = left;
  doc.y = y + 50;
};

const drawPdfTableHeader = (doc: PDFKit.PDFDocument, columns: PdfColumn[]) => {
  const y = doc.y;
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.save();
  doc.rect(left, y, width, 18).fill('#1f2937');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5);
  columns.forEach((column) => {
    doc.text(column.label, column.x, y + 5, {
      width: column.width,
      align: column.align ?? 'left',
      height: 10,
    });
  });
  doc.restore();
  doc.y = y + 22;
};

const drawPdfFooter = (doc: PDFKit.PDFDocument) => {
  const range = doc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const y = doc.page.height - 24;
    doc
      .fillColor('#6b7280')
      .font('Helvetica')
      .fontSize(7)
      .text('Las Tres Estrellas - Sistema de stock', doc.page.margins.left, y, {
        width: 260,
      })
      .text(`Pagina ${i + 1} de ${range.count}`, doc.page.width - doc.page.margins.right - 90, y, {
        width: 90,
        align: 'right',
      });
  }
};

export class ReportesController {
  private static async getVentasPorPeriodo(range: DateRange) {
    const particionRepo = AppDataSource.getRepository(Particion);
    const ventas = await particionRepo
      .createQueryBuilder('particion')
      .leftJoin('particion.unidad', 'unidad')
      .leftJoin('unidad.producto', 'producto')
      .select('DATE(particion.createdAt)', 'fecha')
      .addSelect('producto.nombre', 'producto')
      .addSelect('SUM(particion.peso)', 'totalPeso')
      .addSelect('COUNT(particion.id)', 'cantidadCortes')
      .where('particion.createdAt BETWEEN :fechaInicio AND :fechaFin', range)
      .groupBy('DATE(particion.createdAt)')
      .addGroupBy('producto.nombre')
      .orderBy('DATE(particion.createdAt)', 'ASC')
      .addOrderBy('producto.nombre', 'ASC')
      .getRawMany<RawVenta>();

    return ventas.map(formatVenta);
  }

  private static async getTopProductosRows(limit: number, range?: DateRange) {
    const particionRepo = AppDataSource.getRepository(Particion);
    const query = particionRepo
      .createQueryBuilder('particion')
      .leftJoin('particion.unidad', 'unidad')
      .leftJoin('unidad.producto', 'producto')
      .select('producto.id', 'productoId')
      .addSelect('producto.nombre', 'nombre')
      .addSelect('SUM(particion.peso)', 'totalVendido')
      .addSelect('COUNT(particion.id)', 'cantidadCortes')
      .addSelect('AVG(particion.peso)', 'promedioCorte')
      .groupBy('producto.id')
      .addGroupBy('producto.nombre')
      .orderBy('SUM(particion.peso)', 'DESC')
      .limit(limit);

    if (range) {
      query.where('particion.createdAt BETWEEN :fechaInicio AND :fechaFin', range);
    }

    const topProductos = await query.getRawMany<RawTopProducto>();
    return topProductos.map(formatTopProducto);
  }

  private static async getInventarioActualRows() {
    const unidadRepo = AppDataSource.getRepository(Unidad);
    const inventarioActual = await unidadRepo
      .createQueryBuilder('unidad')
      .leftJoin('unidad.producto', 'producto')
      .leftJoin('producto.tipoQueso', 'tipo')
      .select('COUNT(unidad.id)', 'cantidad')
      .addSelect('SUM(unidad.pesoActual)', 'pesoTotal')
      .addSelect('tipo.nombre', 'tipoQueso')
      .where('unidad.activa = true')
      .groupBy('tipo.nombre')
      .orderBy('tipo.nombre', 'ASC')
      .getRawMany<RawInventario>();

    return inventarioActual.map(formatInventarioActual);
  }

  private static async getInventarioValorizadoRows() {
    const unidadRepo = AppDataSource.getRepository(Unidad);
    const inventario = await unidadRepo
      .createQueryBuilder('unidad')
      .leftJoin('unidad.producto', 'producto')
      .select('producto.nombre', 'producto')
      .addSelect('COUNT(unidad.id)', 'cantidad')
      .addSelect('SUM(unidad.pesoActual)', 'pesoTotal')
      .addSelect('producto.precioPorKilo', 'precioKilo')
      .addSelect('SUM(unidad.pesoActual * producto.precioPorKilo / 1000)', 'valorTotal')
      .where('unidad.activa = true')
      .andWhere('producto.precioPorKilo IS NOT NULL')
      .groupBy('producto.id')
      .addGroupBy('producto.nombre')
      .addGroupBy('producto.precioPorKilo')
      .orderBy('producto.nombre', 'ASC')
      .getRawMany<RawInventario>();

    return inventario.map(formatInventarioValorizado);
  }

  private static async buildDashboardSnapshot(range?: DateRange): Promise<DashboardSnapshot> {
    const hoyRange = {
      fechaInicio: startOfDay(new Date()),
      fechaFin: endOfDay(new Date()),
    };
    const semanaRange = {
      fechaInicio: startOfDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)),
      fechaFin: endOfDay(new Date()),
    };
    const mesRange = {
      fechaInicio: startOfDay(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)),
      fechaFin: endOfDay(new Date()),
    };

    const safe = async <T>(label: string, promise: Promise<T>, fallback: T): Promise<T> => {
      try {
        return await promise;
      } catch (error) {
        console.error(`Error al cargar bloque de dashboard (${label}):`, error);
        return fallback;
      }
    };

    const [inventarioActual, inventarioValorizado, ventasHoy, ventasSemana, ventasMes, topProductos] =
      await Promise.all([
        safe('inventarioActual', this.getInventarioActualRows(), []),
        safe('inventarioValorizado', this.getInventarioValorizadoRows(), []),
        safe('ventasHoy', this.getVentasPorPeriodo(hoyRange), []),
        safe('ventasSemana', this.getVentasPorPeriodo(semanaRange), []),
        safe('ventasMes', this.getVentasPorPeriodo(mesRange), []),
        safe('topProductos', this.getTopProductosRows(10, range), []),
      ]);

    const snapshot: DashboardSnapshot = {
      inventarioActual,
      inventarioValorizado,
      topProductos,
      ventas: {
        hoy: ventasHoy,
        semana: ventasSemana,
        mes: ventasMes,
      },
      alertas: [],
      periodoActual: range
        ? {
            tipo: 'personalizado',
            fechaInicio: formatDateParam(range.fechaInicio),
            fechaFin: formatDateParam(range.fechaFin),
          }
        : {
            tipo: 'semana',
            fechaInicio: null,
            fechaFin: null,
          },
    };

    if (range) {
      snapshot.ventas.personalizado = await safe('ventasPersonalizado', this.getVentasPorPeriodo(range), []);
    }

    return snapshot;
  }

  private static buildResumenExportable(snapshot: DashboardSnapshot, range?: DateRange) {
    const ventas = range ? snapshot.ventas.personalizado ?? [] : snapshot.ventas.semana;
    const totalCortes = ventas.reduce((sum, venta) => sum + venta.cantidadCortes, 0);
    const totalVendido = ventas.reduce((sum, venta) => sum + venta.totalPeso, 0);
    const valorInventario = snapshot.inventarioValorizado.reduce(
      (sum, item) => sum + (item.valorTotal ?? 0),
      0
    );
    const totalUnidades = snapshot.inventarioActual.reduce((sum, item) => sum + item.cantidad, 0);
    const totalPesoStock = snapshot.inventarioActual.reduce((sum, item) => sum + item.pesoTotal, 0);

    return {
      ventas,
      totalCortes,
      totalVendido,
      valorInventario,
      totalUnidades,
      totalPesoStock,
      labelPeriodo: range
        ? `${formatDateParam(range.fechaInicio)} a ${formatDateParam(range.fechaFin)}`
        : 'ultimos 7 dias',
    };
  }

  private static applyUnidadSearch(
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

  private static async getInventarioPdfUnidades(filters: InventarioPdfQuery) {
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

    this.applyUnidadSearch(
      query,
      normalizeSearch(filters.search),
      filters.searchObservaciones === 'true'
    );

    return query.getMany();
  }

  private static async getHistorialPdfUnidades(filters: HistorialPdfQuery, range?: DateRange) {
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

    this.applyUnidadSearch(query, normalizeSearch(filters.search));

    return query.getMany();
  }

  private static drawInventarioTable(doc: PDFKit.PDFDocument, unidades: Unidad[]) {
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

  private static drawHistorialTable(doc: PDFKit.PDFDocument, unidades: Unidad[]) {
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

  static async getDashboard(req: AuthRequest, res: Response) {
    try {
      const rangeResult = parseOptionalRange(req.query as { fechaInicio?: string; fechaFin?: string });

      if (rangeResult?.error) {
        return res.status(rangeResult.error.status).json(rangeResult.error.payload);
      }

      const snapshot = await this.buildDashboardSnapshot(rangeResult?.value);
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

      const topProductos = await this.getTopProductosRows(limit, rangeResult?.value);
      res.json(topProductos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getInventarioValorizado(_req: AuthRequest, res: Response) {
    try {
      const inventario = await this.getInventarioValorizadoRows();
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

      const snapshot = await this.buildDashboardSnapshot(rangeResult?.value);
      const resumen = this.buildResumenExportable(snapshot, rangeResult?.value);
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

      const snapshot = await this.buildDashboardSnapshot(rangeResult?.value);
      const resumen = this.buildResumenExportable(snapshot, rangeResult?.value);
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

  static async exportInventarioPdf(req: AuthRequest, res: Response) {
    try {
      const filters = req.query as InventarioPdfQuery;
      const unidades = await this.getInventarioPdfUnidades(filters);
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
      this.drawInventarioTable(doc, unidades);

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

      const unidades = await this.getHistorialPdfUnidades(filters, rangeResult?.value);
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
      this.drawHistorialTable(doc, unidades);

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
      this.drawSimpleTable(
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
      this.drawSimpleTable(
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

  static async exportNotaPedidoPdf(req: AuthRequest, res: Response) {
    try {
      const notaRepo = AppDataSource.getRepository(NotaPedido);
      const nota = await notaRepo.findOne({
        where: { id: Number(req.params.id) },
        relations: ['cliente', 'items'],
      });

      if (!nota) {
        return res.status(404).json({ error: 'Nota de pedido no encontrada' });
      }

      const empresa = await AppDataSource.getRepository(Empresa).findOne({
        where: {},
        order: { id: 'ASC' },
      });

      const numeroComprobante = `${nota.serie}-${nota.numero}`;
      const pesos = (n: number | string | null | undefined) =>
        `$ ${toNumber(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      // Sin bufferPages: layout propio de una sola página (footer manual).
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const bufferPromise = buildPdfBuffer(doc);

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const contentW = right - left;
      const top = doc.page.margins.top;

      // ----- Encabezado: emisor a la izquierda, comprobante a la derecha -----
      const headerH = 86;
      const splitX = left + contentW * 0.58;
      doc.save();
      doc.roundedRect(left, top, contentW, headerH, 6).fill('#111827');
      doc.restore();

      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(empresa?.razonSocial || 'Mi empresa', left + 16, top + 13, { width: splitX - left - 24 });
      const emisorInfo = [
        [empresa?.cuit ? `CUIT ${empresa.cuit}` : null, empresa?.condicionIva].filter(Boolean).join(' · '),
        empresa?.direccion,
        [empresa?.codigoPostal, empresa?.localidad, empresa?.provincia].filter(Boolean).join(' '),
        empresa?.telefono ? `Tel ${empresa.telefono}` : null,
      ]
        .filter(Boolean)
        .join('\n');
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#cbd5e1')
        .text(emisorInfo, left + 16, top + 38, { width: splitX - left - 24, lineGap: 1.5 });

      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('NOTA DE PEDIDO', splitX, top + 16, { width: right - splitX - 14, align: 'right' });
      doc
        .fontSize(22)
        .text(`N° ${numeroComprobante}`, splitX, top + 32, { width: right - splitX - 14, align: 'right' });
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#cbd5e1')
        .text(`Fecha: ${formatDateLabel(nota.fecha)}`, splitX, top + 62, {
          width: right - splitX - 14,
          align: 'right',
        });

      // ----- Caja de cliente (todo el ancho) -----
      const clienteY = top + headerH + 18;
      const clienteH = 72;
      doc.save();
      doc.roundedRect(left, clienteY, contentW, clienteH, 6).fillAndStroke('#f9fafb', '#e5e7eb');
      doc.restore();
      doc.fillColor('#6b7280').font('Helvetica-Bold').fontSize(8).text('CLIENTE', left + 14, clienteY + 10);
      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(13)
        .text(nota.cliente?.nombre || '-', left + 14, clienteY + 22, { width: contentW - 28 });
      const clienteInfo = [
        nota.cliente?.numeroDocumento ? `${nota.cliente.tipoDocumento} ${nota.cliente.numeroDocumento}` : null,
        nota.cliente?.direccion,
        [nota.cliente?.codigoPostal, nota.cliente?.localidad, nota.cliente?.provincia].filter(Boolean).join(' '),
        nota.cliente?.telefono ? `Tel ${nota.cliente.telefono}` : null,
      ]
        .filter(Boolean)
        .join('   ·   ');
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#374151')
        .text(clienteInfo, left + 14, clienteY + 44, { width: contentW - 28 });

      // ----- Detalle del pedido -----
      doc.x = left;
      doc.y = clienteY + clienteH + 18;
      drawSectionTitle(doc, 'Detalle del pedido');
      this.drawSimpleTable(
        doc,
        [
          { label: 'Cant.', x: 40, width: 40, align: 'center' },
          { label: 'Descripción', x: 80, width: 200 },
          { label: 'Identificación', x: 280, width: 130 },
          { label: 'P. unit.', x: 410, width: 70, align: 'right' },
          { label: 'Subtotal', x: 480, width: 75, align: 'right' },
        ],
        (nota.items ?? []).map((item) => {
          const identificacion = item.tipoItem === 'queso' && item.plu ? `PLU ${item.plu}` : '-';
          return [
            String(item.cantidad),
            truncateText(item.descripcion, 34),
            identificacion,
            pesos(item.precioUnitario),
            pesos(item.subtotal),
          ];
        })
      );

      // ----- Total (chip oscuro a la derecha) -----
      doc.moveDown(0.6);
      const totalY = doc.y;
      doc.save();
      doc.roundedRect(right - 230, totalY, 230, 32, 5).fill('#111827');
      doc.restore();
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(14)
        .text(`TOTAL   ${pesos(nota.total)}`, right - 230, totalY + 9, { width: 216, align: 'right' });
      doc.y = totalY + 44;

      if (nota.observaciones) {
        doc
          .fillColor('#6b7280')
          .font('Helvetica')
          .fontSize(9)
          .text(`Observaciones: ${nota.observaciones}`, left, doc.y, { width: contentW });
      }

      // ----- Pie (manual, una sola hoja) -----
      doc
        .fillColor('#9ca3af')
        .font('Helvetica')
        .fontSize(8)
        .text('Documento no válido como factura · Comprobante interno de venta', left, doc.page.height - 38, {
          width: contentW,
          align: 'center',
        });

      doc.end();
      const buffer = await bufferPromise;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="nota_pedido_${nota.serie}-${nota.numero}.pdf"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async exportReciboPdf(req: AuthRequest, res: Response) {
    try {
      const recibo = await AppDataSource.getRepository(Recibo).findOne({
        where: { id: Number(req.params.id) },
        relations: ['cliente', 'aplicaciones', 'aplicaciones.notaPedido', 'pagos'],
      });

      if (!recibo) {
        return res.status(404).json({ error: 'Recibo no encontrado' });
      }

      const empresa = await AppDataSource.getRepository(Empresa).findOne({
        where: {},
        order: { id: 'ASC' },
      });

      const numeroComprobante = `${recibo.serie}-${recibo.numero}`;
      const pesos = (n: number | string | null | undefined) =>
        `$ ${toNumber(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const medioNombre = (m: string) => (m === 'transferencia' ? 'Transferencia' : 'Efectivo');
      const pagos = recibo.pagos ?? [];
      const mediosTexto =
        pagos.length > 0
          ? pagos.map((p) => `${medioNombre(p.medio)} ${pesos(p.monto)}`).join(' + ')
          : medioNombre(recibo.medioPago);

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const bufferPromise = buildPdfBuffer(doc);

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const contentW = right - left;
      const top = doc.page.margins.top;

      // ----- Encabezado -----
      const headerH = 86;
      const splitX = left + contentW * 0.58;
      doc.save();
      doc.roundedRect(left, top, contentW, headerH, 6).fill('#111827');
      doc.restore();

      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(empresa?.razonSocial || 'Mi empresa', left + 16, top + 13, { width: splitX - left - 24 });
      const emisorInfo = [
        [empresa?.cuit ? `CUIT ${empresa.cuit}` : null, empresa?.condicionIva].filter(Boolean).join(' · '),
        empresa?.direccion,
        [empresa?.codigoPostal, empresa?.localidad, empresa?.provincia].filter(Boolean).join(' '),
        empresa?.telefono ? `Tel ${empresa.telefono}` : null,
      ]
        .filter(Boolean)
        .join('\n');
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#cbd5e1')
        .text(emisorInfo, left + 16, top + 38, { width: splitX - left - 24, lineGap: 1.5 });

      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('RECIBO', splitX, top + 16, { width: right - splitX - 14, align: 'right' });
      doc
        .fontSize(22)
        .text(`N° ${numeroComprobante}`, splitX, top + 32, { width: right - splitX - 14, align: 'right' });
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#cbd5e1')
        .text(`Fecha: ${formatDateLabel(recibo.fecha)}`, splitX, top + 62, {
          width: right - splitX - 14,
          align: 'right',
        });

      // ----- Caja de cliente -----
      const clienteY = top + headerH + 18;
      const clienteH = 60;
      doc.save();
      doc.roundedRect(left, clienteY, contentW, clienteH, 6).fillAndStroke('#f9fafb', '#e5e7eb');
      doc.restore();
      doc.fillColor('#6b7280').font('Helvetica-Bold').fontSize(8).text('RECIBÍ DE', left + 14, clienteY + 10);
      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(13)
        .text(recibo.cliente?.nombre || '-', left + 14, clienteY + 22, { width: contentW - 28 });
      const clienteInfo = [
        recibo.cliente?.numeroDocumento ? `${recibo.cliente.tipoDocumento} ${recibo.cliente.numeroDocumento}` : null,
        recibo.cliente?.localidad,
      ]
        .filter(Boolean)
        .join('   ·   ');
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#374151')
        .text(clienteInfo, left + 14, clienteY + 40, { width: contentW - 28 });

      // ----- Frase + medio de pago -----
      doc.x = left;
      doc.y = clienteY + clienteH + 16;
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#111827')
        .text(`Recibí la suma de ${pesos(recibo.montoTotal)} en concepto de pago, mediante ${mediosTexto}.`, left, doc.y, {
          width: contentW,
        });

      // ----- Detalle: notas pagadas -----
      // Saldo que quedó pendiente en cada nota tras este recibo. Se usa el snapshot
      // guardado al crear el recibo; para recibos viejos (sin snapshot) se cae al
      // saldo actual de la nota.
      const aplicaciones = recibo.aplicaciones ?? [];
      const saldoDe = (ap: (typeof aplicaciones)[number]) =>
        toNumber(ap.saldoPosterior ?? ap.notaPedido?.saldoPendiente ?? 0);
      const saldoAdeudadoTotal = aplicaciones.reduce((s, ap) => s + saldoDe(ap), 0);
      const haySaldo = saldoAdeudadoTotal > 0.001;

      doc.y += 6;
      drawSectionTitle(doc, 'Comprobantes cancelados');
      this.drawSimpleTable(
        doc,
        [
          { label: 'Nota de pedido', x: 40, width: 230 },
          { label: 'Monto aplicado', x: 270, width: 145, align: 'right' },
          { label: 'Saldo pendiente', x: 415, width: 140, align: 'right' },
        ],
        aplicaciones.map((ap) => [
          `Nota ${ap.numeroNota ?? ''}`,
          pesos(ap.monto),
          pesos(saldoDe(ap)),
        ])
      );

      // ----- Total -----
      doc.moveDown(0.6);
      const totalY = doc.y;
      doc.save();
      doc.roundedRect(right - 230, totalY, 230, 32, 5).fill('#111827');
      doc.restore();
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(14)
        .text(`TOTAL   ${pesos(recibo.montoTotal)}`, right - 230, totalY + 9, { width: 216, align: 'right' });
      doc.y = totalY + 44;

      // Saldo adeudado (solo si el/los pagos fueron parciales)
      if (haySaldo) {
        const saldoY = doc.y;
        doc.save();
        doc.roundedRect(right - 230, saldoY, 230, 26, 5).fillAndStroke('#fef2f2', '#fecaca');
        doc.restore();
        doc
          .fillColor('#b91c1c')
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(`SALDO ADEUDADO   ${pesos(saldoAdeudadoTotal)}`, right - 230, saldoY + 8, {
            width: 216,
            align: 'right',
          });
        doc.y = saldoY + 38;
      }

      if (recibo.observaciones) {
        doc
          .fillColor('#6b7280')
          .font('Helvetica')
          .fontSize(9)
          .text(`Observaciones: ${recibo.observaciones}`, left, doc.y, { width: contentW });
      }

      doc
        .fillColor('#9ca3af')
        .font('Helvetica')
        .fontSize(8)
        .text('Documento no válido como factura · Comprobante interno de cobro', left, doc.page.height - 38, {
          width: contentW,
          align: 'center',
        });

      doc.end();
      const buffer = await bufferPromise;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="recibo_${recibo.serie}-${recibo.numero}.pdf"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async exportNotaCreditoPdf(req: AuthRequest, res: Response) {
    try {
      const nc = await AppDataSource.getRepository(NotaCredito).findOne({
        where: { id: Number(req.params.id) },
        relations: ['cliente', 'notaPedido', 'items'],
      });

      if (!nc) {
        return res.status(404).json({ error: 'Nota de crédito no encontrada' });
      }

      const empresa = await AppDataSource.getRepository(Empresa).findOne({
        where: {},
        order: { id: 'ASC' },
      });

      const numeroComprobante = `${nc.serie}-${nc.numero}`;
      const notaRef = nc.notaPedido ? `${nc.notaPedido.serie}-${nc.notaPedido.numero}` : '-';
      const pesos = (n: number | string | null | undefined) =>
        `$ ${toNumber(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const bufferPromise = buildPdfBuffer(doc);

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const contentW = right - left;
      const top = doc.page.margins.top;

      // ----- Encabezado -----
      const headerH = 92;
      const splitX = left + contentW * 0.56;
      doc.save();
      doc.roundedRect(left, top, contentW, headerH, 6).fill('#111827');
      doc.restore();

      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(empresa?.razonSocial || 'Mi empresa', left + 16, top + 13, { width: splitX - left - 24 });
      const emisorInfo = [
        [empresa?.cuit ? `CUIT ${empresa.cuit}` : null, empresa?.condicionIva].filter(Boolean).join(' · '),
        empresa?.direccion,
        [empresa?.codigoPostal, empresa?.localidad, empresa?.provincia].filter(Boolean).join(' '),
        empresa?.telefono ? `Tel ${empresa.telefono}` : null,
      ]
        .filter(Boolean)
        .join('\n');
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#cbd5e1')
        .text(emisorInfo, left + 16, top + 38, { width: splitX - left - 24, lineGap: 1.5 });

      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('NOTA DE CRÉDITO', splitX, top + 14, { width: right - splitX - 14, align: 'right' });
      doc
        .fontSize(21)
        .text(`N° ${numeroComprobante}`, splitX, top + 30, { width: right - splitX - 14, align: 'right' });
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#cbd5e1')
        .text(`s/ Nota de Pedido ${notaRef}`, splitX, top + 58, { width: right - splitX - 14, align: 'right' })
        .text(`Fecha: ${formatDateLabel(nc.fecha)}`, splitX, top + 72, { width: right - splitX - 14, align: 'right' });

      // ----- Caja de cliente -----
      const clienteY = top + headerH + 18;
      const clienteH = 60;
      doc.save();
      doc.roundedRect(left, clienteY, contentW, clienteH, 6).fillAndStroke('#f9fafb', '#e5e7eb');
      doc.restore();
      doc.fillColor('#6b7280').font('Helvetica-Bold').fontSize(8).text('CLIENTE', left + 14, clienteY + 10);
      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(13)
        .text(nc.cliente?.nombre || '-', left + 14, clienteY + 22, { width: contentW - 28 });
      const clienteInfo = [
        nc.cliente?.numeroDocumento ? `${nc.cliente.tipoDocumento} ${nc.cliente.numeroDocumento}` : null,
        nc.cliente?.localidad,
      ]
        .filter(Boolean)
        .join('   ·   ');
      doc.font('Helvetica').fontSize(9).fillColor('#374151').text(clienteInfo, left + 14, clienteY + 40, { width: contentW - 28 });

      // ----- Detalle: ítems devueltos -----
      doc.x = left;
      doc.y = clienteY + clienteH + 18;
      drawSectionTitle(doc, 'Ítems devueltos');
      this.drawSimpleTable(
        doc,
        [
          { label: 'Cant.', x: 40, width: 40, align: 'center' },
          { label: 'Descripción', x: 80, width: 250 },
          { label: 'Identificación', x: 330, width: 80 },
          { label: 'P. unit.', x: 410, width: 70, align: 'right' },
          { label: 'Subtotal', x: 480, width: 75, align: 'right' },
        ],
        (nc.items ?? []).map((item) => [
          String(item.cantidad),
          truncateText(item.descripcion, 40),
          item.tipoItem === 'queso' && item.plu ? `PLU ${item.plu}` : '-',
          pesos(item.precioUnitario),
          pesos(item.subtotal),
        ])
      );

      // ----- Total -----
      doc.moveDown(0.6);
      const totalY = doc.y;
      doc.save();
      doc.roundedRect(right - 230, totalY, 230, 32, 5).fill('#111827');
      doc.restore();
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(14)
        .text(`TOTAL   ${pesos(nc.montoTotal)}`, right - 230, totalY + 9, { width: 216, align: 'right' });
      doc.y = totalY + 44;

      if (nc.motivo) {
        doc.fillColor('#6b7280').font('Helvetica').fontSize(9).text(`Motivo: ${nc.motivo}`, left, doc.y, { width: contentW });
      }

      doc
        .fillColor('#9ca3af')
        .font('Helvetica')
        .fontSize(8)
        .text('Documento no válido como factura · Comprobante interno de devolución', left, doc.page.height - 38, {
          width: contentW,
          align: 'center',
        });

      doc.end();
      const buffer = await bufferPromise;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="nota_credito_${nc.serie}-${nc.numero}.pdf"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async exportReporteFacturacionPdf(req: AuthRequest, res: Response) {
    try {
      const desde = typeof req.query.desde === 'string' ? req.query.desde : undefined;
      const hasta = typeof req.query.hasta === 'string' ? req.query.hasta : undefined;
      const data = await computeReporte(desde, hasta);

      const pesos = (n: number | string | null | undefined) =>
        `$ ${toNumber(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const periodoLabel =
        data.periodo.desde && data.periodo.hasta ? `${data.periodo.desde} a ${data.periodo.hasta}` : 'Histórico';

      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      const bufferPromise = buildPdfBuffer(doc);

      drawReportHeader(doc, 'Reporte de ventas', `Las Tres Estrellas | Período: ${periodoLabel}`);
      drawSummaryCards(doc, [
        { label: 'Facturado', value: pesos(data.resumen.totalFacturado) },
        { label: 'Cobrado', value: pesos(data.resumen.totalCobrado) },
        { label: 'Notas de crédito', value: pesos(data.resumen.totalCreditado) },
        { label: 'Saldo pendiente (hoy)', value: pesos(data.resumen.saldoPendienteTotal) },
      ]);

      drawSectionTitle(doc, `Ventas por producto (${periodoLabel})`);
      this.drawSimpleTable(
        doc,
        [
          { label: 'Producto / Ítem', x: 40, width: 320 },
          { label: 'Cantidad', x: 360, width: 90, align: 'right' },
          { label: 'Monto', x: 450, width: 105, align: 'right' },
        ],
        data.ventasPorProducto.map((v) => [truncateText(v.descripcion, 48), String(v.cantidad), pesos(v.monto)])
      );

      drawSectionTitle(doc, 'Cuenta corriente (saldo actual por cliente)');
      this.drawSimpleTable(
        doc,
        [
          { label: 'Cliente', x: 40, width: 235 },
          { label: 'Facturado', x: 275, width: 95, align: 'right' },
          { label: 'Cobrado', x: 370, width: 90, align: 'right' },
          { label: 'Saldo', x: 460, width: 95, align: 'right' },
        ],
        data.cuentaCorriente.map((c) => [
          truncateText(c.cliente, 34),
          pesos(c.facturado),
          pesos(c.cobrado),
          pesos(c.saldo),
        ])
      );

      drawPdfFooter(doc);
      doc.end();
      const buffer = await bufferPromise;
      const fileSuffix = data.periodo.desde && data.periodo.hasta ? `${data.periodo.desde}_${data.periodo.hasta}` : 'historico';

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="reporte_ventas_${fileSuffix}.pdf"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ----------------------------- Indumentaria -----------------------------

  private static async buildIndumentariaSnapshot(range?: DateRange): Promise<IndumentariaSnapshot> {
    const repo = AppDataSource.getRepository(Indumentaria);
    const movRepo = AppDataSource.getRepository(MovimientoIndumentaria);

    const safe = async <T>(label: string, promise: Promise<T>, fallback: T): Promise<T> => {
      try {
        return await promise;
      } catch (error) {
        console.error(`Error al cargar bloque de indumentaria (${label}):`, error);
        return fallback;
      }
    };

    const applyRange = (qb: SelectQueryBuilder<MovimientoIndumentaria>) => {
      if (range) {
        qb.andWhere('m.fechaMovimiento BETWEEN :fechaInicio AND :fechaFin', range);
      }
      return qb;
    };

    const resumenStockQuery = repo
      .createQueryBuilder('i')
      .select('COUNT(i.id)', 'totalPrendas')
      .addSelect('COALESCE(SUM(i.cantidadDisponible), 0)', 'totalUnidades')
      .addSelect('COALESCE(SUM(i.cantidadTotalIngresada), 0)', 'totalIngresado')
      .where('i.activo = true')
      .getRawOne<{ totalPrendas: string; totalUnidades: string; totalIngresado: string }>();

    const stockBajoQuery = repo
      .createQueryBuilder('i')
      .where('i.activo = true')
      .andWhere('i.stockMinimo > 0')
      .andWhere('i.cantidadDisponible <= i.stockMinimo')
      .orderBy('i.cantidadDisponible', 'ASC')
      .getMany();

    const porCategoriaQuery = repo
      .createQueryBuilder('i')
      .select("COALESCE(NULLIF(TRIM(i.categoria), ''), 'Sin categoria')", 'categoria')
      .addSelect('COUNT(i.id)', 'prendas')
      .addSelect('COALESCE(SUM(i.cantidadDisponible), 0)', 'unidades')
      .where('i.activo = true')
      .groupBy("COALESCE(NULLIF(TRIM(i.categoria), ''), 'Sin categoria')")
      .orderBy('unidades', 'DESC')
      .getRawMany<{ categoria: string; prendas: string; unidades: string }>();

    const porProveedorQuery = repo
      .createQueryBuilder('i')
      .leftJoin('i.proveedor', 'p')
      .select("COALESCE(p.nombre, 'Sin proveedor')", 'proveedor')
      .addSelect('COUNT(i.id)', 'prendas')
      .addSelect('COALESCE(SUM(i.cantidadDisponible), 0)', 'unidades')
      .where('i.activo = true')
      .groupBy('p.nombre')
      .orderBy('unidades', 'DESC')
      .getRawMany<{ proveedor: string; prendas: string; unidades: string }>();

    const topEntregasQuery = applyRange(
      movRepo
        .createQueryBuilder('m')
        .select("COALESCE(NULLIF(TRIM(m.destino), ''), 'Sin destino')", 'destino')
        .addSelect('COALESCE(SUM(m.cantidad), 0)', 'cantidad')
        .addSelect('COUNT(m.id)', 'entregas')
        .where("m.tipo = 'EGRESO'")
    )
      .groupBy("COALESCE(NULLIF(TRIM(m.destino), ''), 'Sin destino')")
      .orderBy('cantidad', 'DESC')
      .limit(15)
      .getRawMany<{ destino: string; cantidad: string; entregas: string }>();

    const topPrendasQuery = applyRange(
      movRepo
        .createQueryBuilder('m')
        .leftJoin('m.indumentaria', 'i')
        .select('i.nombre', 'nombre')
        .addSelect('COALESCE(SUM(m.cantidad), 0)', 'cantidad')
        .where("m.tipo = 'EGRESO'")
    )
      .groupBy('i.id')
      .addGroupBy('i.nombre')
      .orderBy('cantidad', 'DESC')
      .limit(10)
      .getRawMany<{ nombre: string; cantidad: string }>();

    const totalEntregadoQuery = applyRange(
      movRepo
        .createQueryBuilder('m')
        .select('COALESCE(SUM(m.cantidad), 0)', 'total')
        .where("m.tipo = 'EGRESO'")
    ).getRawOne<{ total: string }>();

    const movimientosPorDiaQuery = applyRange(
      movRepo
        .createQueryBuilder('m')
        .select('DATE(m.fechaMovimiento)', 'fecha')
        .addSelect("COALESCE(SUM(CASE WHEN m.tipo = 'INGRESO' THEN m.cantidad ELSE 0 END), 0)", 'ingresos')
        .addSelect("COALESCE(SUM(CASE WHEN m.tipo = 'EGRESO' THEN m.cantidad ELSE 0 END), 0)", 'egresos')
        .where('1 = 1')
    )
      .groupBy('DATE(m.fechaMovimiento)')
      .orderBy('DATE(m.fechaMovimiento)', 'ASC')
      .getRawMany<{ fecha: string; ingresos: string; egresos: string }>();

    const [
      resumenStock,
      stockBajo,
      porCategoria,
      porProveedor,
      topEntregas,
      topPrendas,
      totalEntregadoRow,
      movimientosPorDia,
    ] = await Promise.all([
      safe('resumenStock', resumenStockQuery, { totalPrendas: '0', totalUnidades: '0', totalIngresado: '0' }),
      safe('stockBajo', stockBajoQuery, [] as Indumentaria[]),
      safe('porCategoria', porCategoriaQuery, [] as { categoria: string; prendas: string; unidades: string }[]),
      safe('porProveedor', porProveedorQuery, [] as { proveedor: string; prendas: string; unidades: string }[]),
      safe('topEntregas', topEntregasQuery, [] as { destino: string; cantidad: string; entregas: string }[]),
      safe('topPrendas', topPrendasQuery, [] as { nombre: string; cantidad: string }[]),
      safe('totalEntregado', totalEntregadoQuery, { total: '0' }),
      safe('movimientosPorDia', movimientosPorDiaQuery, [] as { fecha: string; ingresos: string; egresos: string }[]),
    ]);

    return {
      resumen: {
        totalPrendas: toNumber(resumenStock?.totalPrendas),
        totalUnidades: toNumber(resumenStock?.totalUnidades),
        totalIngresado: toNumber(resumenStock?.totalIngresado),
        totalEntregado: toNumber(totalEntregadoRow?.total),
        prendasStockBajo: stockBajo.length,
      },
      porCategoria: porCategoria.map((row) => ({
        categoria: row.categoria,
        prendas: toNumber(row.prendas),
        unidades: toNumber(row.unidades),
      })),
      porProveedor: porProveedor.map((row) => ({
        proveedor: row.proveedor,
        prendas: toNumber(row.prendas),
        unidades: toNumber(row.unidades),
      })),
      topEntregas: topEntregas.map((row) => ({
        destino: row.destino,
        cantidad: toNumber(row.cantidad),
        entregas: toNumber(row.entregas),
      })),
      topPrendasEntregadas: topPrendas.map((row) => ({
        nombre: row.nombre,
        cantidad: toNumber(row.cantidad),
      })),
      movimientosPorDia: movimientosPorDia.map((row) => ({
        fecha: formatDateParam(new Date(row.fecha)),
        ingresos: toNumber(row.ingresos),
        egresos: toNumber(row.egresos),
      })),
      stockBajo: stockBajo.map((prenda) => ({
        id: prenda.id,
        nombre: prenda.nombre,
        talle: prenda.talle,
        cantidadDisponible: toNumber(prenda.cantidadDisponible),
        stockMinimo: toNumber(prenda.stockMinimo),
      })),
      periodo: {
        fechaInicio: range ? formatDateParam(range.fechaInicio) : null,
        fechaFin: range ? formatDateParam(range.fechaFin) : null,
        label: range
          ? `${formatDateParam(range.fechaInicio)} a ${formatDateParam(range.fechaFin)}`
          : 'historico completo',
      },
    };
  }

  private static drawSimpleTable(doc: PDFKit.PDFDocument, columns: PdfColumn[], rows: string[][]) {
    drawPdfTableHeader(doc, columns);

    if (!rows.length) {
      doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text('Sin datos para mostrar.');
      doc.fillColor('#000000');
      return;
    }

    rows.forEach((row, index) => {
      ensurePdfSpace(doc, 20, () => drawPdfTableHeader(doc, columns));
      const rowY = doc.y;

      if (index % 2 === 0) {
        doc
          .save()
          .rect(doc.page.margins.left, rowY - 3, doc.page.width - doc.page.margins.left - doc.page.margins.right, 18)
          .fill('#f9fafb')
          .restore();
      }

      doc.fillColor('#111827').font('Helvetica').fontSize(8);
      columns.forEach((column, colIndex) => {
        doc.text(row[colIndex] ?? '-', column.x, rowY + 2, {
          width: column.width,
          height: 12,
          align: column.align ?? 'left',
        });
      });
      doc.y = rowY + 20;
    });
  }

  static async getIndumentariaDashboard(req: AuthRequest, res: Response) {
    try {
      const rangeResult = parseOptionalRange(req.query as { fechaInicio?: string; fechaFin?: string });

      if (rangeResult?.error) {
        return res.status(rangeResult.error.status).json(rangeResult.error.payload);
      }

      const snapshot = await this.buildIndumentariaSnapshot(rangeResult?.value);
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

      const snapshot = await this.buildIndumentariaSnapshot(rangeResult?.value);
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

      const snapshot = await this.buildIndumentariaSnapshot(rangeResult?.value);
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
      this.drawSimpleTable(
        doc,
        [
          { label: 'Categoria', x: 40, width: 260 },
          { label: 'Prendas', x: 300, width: 120, align: 'right' },
          { label: 'Unidades', x: 420, width: 135, align: 'right' },
        ],
        snapshot.porCategoria.map((row) => [row.categoria, String(row.prendas), String(row.unidades)])
      );

      drawSectionTitle(doc, 'Entregas por destino (a quien se entrego)');
      this.drawSimpleTable(
        doc,
        [
          { label: 'Destino', x: 40, width: 280 },
          { label: 'Unidades', x: 320, width: 120, align: 'right' },
          { label: 'Entregas', x: 445, width: 110, align: 'right' },
        ],
        snapshot.topEntregas.map((row) => [row.destino, String(row.cantidad), String(row.entregas)])
      );

      drawSectionTitle(doc, 'Prendas mas entregadas');
      this.drawSimpleTable(
        doc,
        [
          { label: 'Prenda', x: 40, width: 360 },
          { label: 'Unidades entregadas', x: 400, width: 155, align: 'right' },
        ],
        snapshot.topPrendasEntregadas.map((row) => [row.nombre, String(row.cantidad)])
      );

      drawSectionTitle(doc, 'Stock por proveedor');
      this.drawSimpleTable(
        doc,
        [
          { label: 'Proveedor', x: 40, width: 260 },
          { label: 'Prendas', x: 300, width: 120, align: 'right' },
          { label: 'Unidades', x: 420, width: 135, align: 'right' },
        ],
        snapshot.porProveedor.map((row) => [row.proveedor, String(row.prendas), String(row.unidades)])
      );

      drawSectionTitle(doc, 'Prendas con stock bajo');
      this.drawSimpleTable(
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

import { Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Brackets, SelectQueryBuilder } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Particion } from '../entities/Particion';
import { Unidad } from '../entities/Unidad';
import { AuthRequest } from '../middlewares/auth';

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
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(13).text(title);
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
}

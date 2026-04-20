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
  fecha: row.fecha,
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
  doc.font('Helvetica-Bold').fontSize(13).text(title);
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
      { label: 'ID', x: 35, width: 40 },
      { label: 'Producto', x: 75, width: 170 },
      { label: 'PLU', x: 250, width: 70 },
      { label: 'Tipo', x: 320, width: 85 },
      { label: 'Inicial', x: 405, width: 65 },
      { label: 'Actual', x: 470, width: 65 },
      { label: 'Egreso', x: 535, width: 65 },
      { label: 'Motivo', x: 600, width: 95 },
      { label: 'Ingreso', x: 695, width: 90 },
    ];

    const drawHeader = () => {
      doc.font('Helvetica-Bold').fontSize(8);
      columns.forEach((column) => doc.text(column.label, column.x, doc.y, { width: column.width }));
      doc.moveDown(0.4);
      doc.moveTo(35, doc.y).lineTo(790, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(0.4);
    };

    drawHeader();

    if (!unidades.length) {
      doc.font('Helvetica').fontSize(10).text('No hay unidades para los filtros seleccionados.');
      return;
    }

    unidades.forEach((unidad) => {
      ensurePdfSpace(doc, 28, drawHeader);
      const rowY = doc.y;
      const egreso = toNumber(unidad.pesoInicial) - toNumber(unidad.pesoActual);
      const values = [
        `#${unidad.id}`,
        unidad.producto?.nombre ?? '-',
        unidad.producto?.plu ?? '-',
        unidad.producto?.tipoQueso?.nombre ?? '-',
        formatKgLabel(unidad.pesoInicial),
        formatKgLabel(unidad.pesoActual),
        formatKgLabel(egreso),
        textOrDash(unidad.motivo?.nombre),
        formatDateLabel(unidad.createdAt),
      ];

      doc.font('Helvetica').fontSize(8);
      columns.forEach((column, index) => {
        doc.text(values[index], column.x, rowY, { width: column.width, height: 24 });
      });
      doc.y = rowY + 28;
    });
  }

  private static drawHistorialTable(doc: PDFKit.PDFDocument, unidades: Unidad[]) {
    const columns = [
      { label: 'ID', x: 35, width: 40 },
      { label: 'Producto', x: 75, width: 185 },
      { label: 'Estado', x: 260, width: 65 },
      { label: 'Tipo', x: 325, width: 85 },
      { label: 'Inicial', x: 410, width: 65 },
      { label: 'Actual', x: 475, width: 65 },
      { label: 'Egreso', x: 540, width: 65 },
      { label: 'Ingreso', x: 605, width: 80 },
      { label: 'Cortes', x: 685, width: 75 },
    ];

    const drawHeader = () => {
      doc.font('Helvetica-Bold').fontSize(8);
      columns.forEach((column) => doc.text(column.label, column.x, doc.y, { width: column.width }));
      doc.moveDown(0.4);
      doc.moveTo(35, doc.y).lineTo(790, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(0.4);
    };

    drawHeader();

    if (!unidades.length) {
      doc.font('Helvetica').fontSize(10).text('No hay unidades para los filtros seleccionados.');
      return;
    }

    unidades.forEach((unidad) => {
      const cortes = unidad.particiones ?? [];
      const detailLines = [
        `PLU: ${unidad.producto?.plu ?? '-'} | Motivo ingreso: ${textOrDash(unidad.motivo?.nombre)}`,
        unidad.observacionesIngreso ? `Obs ingreso: ${unidad.observacionesIngreso}` : '',
        cortes.length
          ? `Cortes: ${cortes
              .map((corte) => `${formatDateLabel(corte.createdAt)} ${formatKgLabel(corte.peso)} ${textOrDash(corte.motivo?.nombre)}`)
              .join(' | ')}`
          : 'Cortes: sin cortes registrados',
      ].filter(Boolean);
      const rowHeight = 30 + detailLines.length * 11;

      ensurePdfSpace(doc, rowHeight, drawHeader);
      const rowY = doc.y;
      const egreso = toNumber(unidad.pesoInicial) - toNumber(unidad.pesoActual);
      const estado = unidad.deletedAt ? 'Eliminada' : unidad.activa ? 'Activa' : 'Agotada';
      const values = [
        `#${unidad.id}`,
        unidad.producto?.nombre ?? '-',
        estado,
        unidad.producto?.tipoQueso?.nombre ?? '-',
        formatKgLabel(unidad.pesoInicial),
        formatKgLabel(unidad.pesoActual),
        formatKgLabel(egreso),
        formatDateLabel(unidad.createdAt),
        String(cortes.length),
      ];

      doc.font('Helvetica').fontSize(8);
      columns.forEach((column, index) => {
        doc.text(values[index], column.x, rowY, { width: column.width, height: 24 });
      });

      doc.font('Helvetica').fontSize(7).fillColor('#444444');
      let detailY = rowY + 18;
      detailLines.forEach((line) => {
        doc.text(line, 75, detailY, { width: 700, height: 10 });
        detailY += 11;
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
      const doc = new PDFDocument({ margin: 35, size: 'A4', layout: 'landscape' });
      const bufferPromise = buildPdfBuffer(doc);

      doc.font('Helvetica-Bold').fontSize(18).text('Inventario actual de quesos');
      doc.moveDown(0.4);
      doc.font('Helvetica').fontSize(10);
      doc.text(`Generado: ${formatDateLabel(new Date())}`);
      doc.text(`Unidades: ${unidades.length}`);
      doc.text(`Peso actual total: ${formatKgLabel(totalPeso)}`);
      doc.text(`Egreso acumulado: ${formatKgLabel(totalEgreso)}`);
      if (filters.search) {
        doc.text(`Busqueda: ${filters.search}`);
      }

      drawSectionTitle(doc, 'Detalle');
      this.drawInventarioTable(doc, unidades);

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
      const doc = new PDFDocument({ margin: 35, size: 'A4', layout: 'landscape' });
      const bufferPromise = buildPdfBuffer(doc);
      const estadoLabel = filters.estado && filters.estado !== 'todos' ? filters.estado : 'todos';
      const periodoLabel = rangeResult?.value
        ? `${formatDateParam(rangeResult.value.fechaInicio)} a ${formatDateParam(rangeResult.value.fechaFin)}`
        : 'sin rango';

      doc.font('Helvetica-Bold').fontSize(18).text('Historial de quesos');
      doc.moveDown(0.4);
      doc.font('Helvetica').fontSize(10);
      doc.text(`Generado: ${formatDateLabel(new Date())}`);
      doc.text(`Periodo: ${periodoLabel}`);
      doc.text(`Estado: ${estadoLabel}`);
      doc.text(`Unidades: ${unidades.length} | Activas: ${totalActivas} | Agotadas/eliminadas: ${totalAgotadas}`);
      doc.text(`Peso inicial total: ${formatKgLabel(totalPeso)} | Egreso total: ${formatKgLabel(totalEgreso)} | Cortes: ${totalCortes}`);
      if (filters.search) {
        doc.text(`Busqueda: ${filters.search}`);
      }

      drawSectionTitle(doc, 'Detalle de unidades y cortes');
      this.drawHistorialTable(doc, unidades);

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

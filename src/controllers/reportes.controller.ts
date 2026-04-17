import { Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
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
      .orderBy('totalVendido', 'DESC')
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

    const [inventarioActual, inventarioValorizado, ventasHoy, ventasSemana, ventasMes, topProductos] =
      await Promise.all([
        this.getInventarioActualRows(),
        this.getInventarioValorizadoRows(),
        this.getVentasPorPeriodo(hoyRange),
        this.getVentasPorPeriodo(semanaRange),
        this.getVentasPorPeriodo(mesRange),
        this.getTopProductosRows(10, range),
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
      snapshot.ventas.personalizado = await this.getVentasPorPeriodo(range);
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
}

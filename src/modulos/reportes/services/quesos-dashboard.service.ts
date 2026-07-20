// src/modulos/reportes/services/quesos-dashboard.service.ts
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

export async function getVentasPorPeriodo(range: DateRange) {
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

export async function getTopProductosRows(limit: number, range?: DateRange) {
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

export async function getInventarioActualRows() {
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

export async function getInventarioValorizadoRows() {
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

export async function buildDashboardSnapshot(range?: DateRange): Promise<DashboardSnapshot> {
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
        safe('inventarioActual', getInventarioActualRows(), []),
        safe('inventarioValorizado', getInventarioValorizadoRows(), []),
        safe('ventasHoy', getVentasPorPeriodo(hoyRange), []),
        safe('ventasSemana', getVentasPorPeriodo(semanaRange), []),
        safe('ventasMes', getVentasPorPeriodo(mesRange), []),
        safe('topProductos', getTopProductosRows(10, range), []),
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
      snapshot.ventas.personalizado = await safe('ventasPersonalizado', getVentasPorPeriodo(range), []);
    }

    return snapshot;
  }

export function buildResumenExportable(snapshot: DashboardSnapshot, range?: DateRange) {
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


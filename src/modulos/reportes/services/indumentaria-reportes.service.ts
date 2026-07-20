// src/modulos/reportes/services/indumentaria-reportes.service.ts
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

export async function buildIndumentariaSnapshot(range?: DateRange): Promise<IndumentariaSnapshot> {
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


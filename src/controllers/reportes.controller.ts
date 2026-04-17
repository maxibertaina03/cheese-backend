import { Response } from 'express';
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

const formatVenta = (row: RawVenta) => ({
  fecha: row.fecha,
  producto: row.producto,
  motivo: row.motivo ?? null,
  totalPeso: toNumber(row.totalPeso),
  cantidadCortes: toNumber(row.cantidadCortes),
});

const formatTopProducto = (row: RawTopProducto) => ({
  productoId: Number(row.productoId),
  nombre: row.nombre,
  totalVendido: toNumber(row.totalVendido),
  cantidadCortes: toNumber(row.cantidadCortes),
  promedioCorte: toNumber(row.promedioCorte),
});

const formatInventarioActual = (row: RawInventario) => ({
  cantidad: toNumber(row.cantidad),
  pesoTotal: toNumber(row.pesoTotal),
  tipoQueso: row.tipoQueso ?? 'Sin tipo',
});

const formatInventarioValorizado = (row: RawInventario) => ({
  producto: row.producto ?? 'Sin producto',
  cantidad: toNumber(row.cantidad),
  pesoTotal: toNumber(row.pesoTotal),
  precioKilo: toNumber(row.precioKilo),
  valorTotal: toNumber(row.valorTotal),
});

export class ReportesController {
  private static async getVentasPorPeriodo(inicio: Date, fin?: Date) {
    const particionRepo = AppDataSource.getRepository(Particion);
    const query = particionRepo
      .createQueryBuilder('particion')
      .leftJoin('particion.unidad', 'unidad')
      .leftJoin('unidad.producto', 'producto')
      .select('DATE(particion.createdAt)', 'fecha')
      .addSelect('producto.nombre', 'producto')
      .addSelect('SUM(particion.peso)', 'totalPeso')
      .addSelect('COUNT(particion.id)', 'cantidadCortes')
      .where('particion.createdAt >= :inicio', { inicio });

    if (fin) {
      query.andWhere('particion.createdAt <= :fin', { fin });
    }

    const ventas = await query
      .groupBy('DATE(particion.createdAt)')
      .addGroupBy('producto.nombre')
      .orderBy('DATE(particion.createdAt)', 'ASC')
      .addOrderBy('producto.nombre', 'ASC')
      .getRawMany<RawVenta>();

    return ventas.map(formatVenta);
  }

  private static async getTopProductosRows(limit: number) {
    const particionRepo = AppDataSource.getRepository(Particion);
    const topProductos = await particionRepo
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
      .limit(limit)
      .getRawMany<RawTopProducto>();

    return topProductos.map(formatTopProducto);
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

  static async getDashboard(_req: AuthRequest, res: Response) {
    try {
      const hoy = startOfDay(new Date());
      const hace7dias = startOfDay(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      const hace30dias = startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

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

      const [ventasHoy, ventasSemana, ventasMes, topProductos, inventarioValorizado] = await Promise.all([
        this.getVentasPorPeriodo(hoy),
        this.getVentasPorPeriodo(hace7dias),
        this.getVentasPorPeriodo(hace30dias),
        this.getTopProductosRows(10),
        this.getInventarioValorizadoRows(),
      ]);

      res.json({
        inventarioActual: inventarioActual.map(formatInventarioActual),
        ventas: {
          hoy: ventasHoy,
          semana: ventasSemana,
          mes: ventasMes,
        },
        topProductos,
        inventarioValorizado,
        alertas: [],
      });
    } catch (error: any) {
      console.error('Error en getDashboard:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getVentas(req: AuthRequest, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query as { fechaInicio: string; fechaFin: string };
      const inicio = startOfDay(new Date(fechaInicio));
      const fin = endOfDay(new Date(fechaFin));

      if (inicio > fin) {
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
        .where('particion.createdAt BETWEEN :inicio AND :fin', { inicio, fin })
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
      const { limit = 10 } = req.query as { limit?: number };
      const topProductos = await this.getTopProductosRows(limit);
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
}

// src/modulos/reportes/reportes-comunes.ts
// Tipos y helpers compartidos por los reportes (dashboards, PDFs, Excel).

export type RawVenta = {
  fecha: string;
  producto: string;
  totalPeso: string | number | null;
  cantidadCortes: string | number | null;
  motivo?: string | null;
};

export type RawTopProducto = {
  productoId: string | number;
  nombre: string;
  totalVendido: string | number | null;
  cantidadCortes: string | number | null;
  promedioCorte: string | number | null;
};

export type RawInventario = {
  cantidad: string | number | null;
  pesoTotal: string | number | null;
  precioKilo?: string | number | null;
  producto?: string | null;
  tipoQueso?: string | null;
  valorTotal?: string | number | null;
};

export type DashboardVenta = {
  fecha: string;
  producto: string;
  motivo: string | null;
  totalPeso: number;
  cantidadCortes: number;
};

export type DashboardTopProducto = {
  productoId: number;
  nombre: string;
  totalVendido: number;
  cantidadCortes: number;
  promedioCorte: number;
};

export type DashboardInventario = {
  cantidad: number;
  pesoTotal: number;
  tipoQueso?: string;
  producto?: string;
  precioKilo?: number;
  valorTotal?: number;
};

export type DateRange = {
  fechaInicio: Date;
  fechaFin: Date;
};

export type DashboardPeriod = 'hoy' | 'semana' | 'mes';

export type DashboardSnapshot = {
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

export type IndumentariaSnapshot = {
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

export type InventarioPdfQuery = {
  search?: string;
  tipoQuesoId?: number;
  searchObservaciones?: string;
};

export type HistorialPdfQuery = InventarioPdfQuery & {
  estado?: 'todos' | 'activos' | 'agotados';
  fechaInicio?: string;
  fechaFin?: string;
};

export const toNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  return Number(value);
};

export const startOfDay = (date: Date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

export const endOfDay = (date: Date) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

export const formatVenta = (row: RawVenta): DashboardVenta => ({
  fecha: formatDateParam(new Date(row.fecha)),
  producto: row.producto,
  motivo: row.motivo ?? null,
  totalPeso: toNumber(row.totalPeso),
  cantidadCortes: toNumber(row.cantidadCortes),
});

export const formatTopProducto = (row: RawTopProducto): DashboardTopProducto => ({
  productoId: Number(row.productoId),
  nombre: row.nombre,
  totalVendido: toNumber(row.totalVendido),
  cantidadCortes: toNumber(row.cantidadCortes),
  promedioCorte: toNumber(row.promedioCorte),
});

export const formatInventarioActual = (row: RawInventario): DashboardInventario => ({
  cantidad: toNumber(row.cantidad),
  pesoTotal: toNumber(row.pesoTotal),
  tipoQueso: row.tipoQueso ?? 'Sin tipo',
});

export const formatInventarioValorizado = (row: RawInventario): DashboardInventario => ({
  producto: row.producto ?? 'Sin producto',
  cantidad: toNumber(row.cantidad),
  pesoTotal: toNumber(row.pesoTotal),
  precioKilo: toNumber(row.precioKilo),
  valorTotal: toNumber(row.valorTotal),
});

export const formatDateParam = (date: Date) => date.toISOString().slice(0, 10);

export const formatKg = (grams: number) => Number((grams / 1000).toFixed(2));

export const formatKgLabel = (grams: string | number | null | undefined) =>
  `${formatKg(toNumber(grams)).toFixed(2)} kg`;

export const normalizeSearch = (value: string | undefined) => value?.trim().toLowerCase() ?? '';

export const parseOptionalRange = (query: { fechaInicio?: string; fechaFin?: string }) => {
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

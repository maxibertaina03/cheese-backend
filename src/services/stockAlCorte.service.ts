import { AppDataSource } from '../config/database';
import { Producto } from '../entities/Producto';
import { Unidad } from '../entities/Unidad';
import { MovimientoStockComercial } from '../modules/facturacion/entities/MovimientoStockComercial';

export interface StockLunesProducto {
  productoId: number;
  producto: string;
  plu: string;
  tipoQueso: string | null;
  cantidadFisico: number;    // hormas físicas (pistola) en stock ese lunes
  cantidadComercial: number; // stock de venta (facturación) ese lunes
}

export interface MovimientoDesdeCorte {
  tipo: 'corte' | 'baja';
  unidadId: number;
  producto: string;
  tipoQueso: string | null;
  peso: number | null;
  motivo: string | null;
  fecha: string;
  agotoUnidad: boolean;
}

export interface StockAlCorteResult {
  fechaCorte: string;
  totalFisico: number;
  totalComercial: number;
  productos: StockLunesProducto[];
  movimientos: MovimientoDesdeCorte[];
}

/**
 * Calcula el inicio (00:00) del lunes más reciente, en horario local del servidor.
 * Se usa solo como fallback: normalmente el frontend envía la fecha de corte ya
 * calculada en la zona horaria del usuario.
 */
export const getUltimoLunes = (): Date => {
  const now = new Date();
  const day = now.getDay(); // 0 = domingo, 1 = lunes, ...
  const diasDesdeLunes = (day + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diasDesdeLunes, 0, 0, 0, 0);
};

/**
 * Reconstruye el stock de quesos que existía en una fecha de corte (por defecto, el
 * lunes más reciente), desglosado producto por producto, y los movimientos (cortes y
 * bajas) que esas unidades tuvieron desde el corte hasta ahora.
 *
 * Una unidad estaba en stock en la fecha de corte si fue creada antes del corte, no
 * estaba dada de baja en ese momento, y además: o bien sigue activa hoy (su peso solo
 * pudo haber bajado, así que en el corte tenía peso), o bien está agotada pero su
 * último corte ocurrió DESPUÉS de la fecha de corte (se vació más tarde). Se usan estas
 * señales firmes en lugar de restar pesos, que sufre derivas de redondeo.
 */
export async function computeStockAlCorte(corte: Date, ahora: Date = new Date()): Promise<StockAlCorteResult> {
  const unidadRepo = AppDataSource.getRepository(Unidad);
  const unidades = await unidadRepo.find({
    relations: ['producto', 'producto.tipoQueso', 'particiones', 'particiones.motivo'],
    withDeleted: true,
  });

  const productos = new Map<number, StockLunesProducto>();
  const movimientos: MovimientoDesdeCorte[] = [];
  let totalFisico = 0;

  const corteMs = corte.getTime();
  const ahoraMs = ahora.getTime();

  const getGrupo = (prod: { id: number; nombre: string; plu: string; tipoQueso?: { nombre: string } | null }) => {
    let g = productos.get(prod.id);
    if (!g) {
      g = {
        productoId: prod.id,
        producto: prod.nombre,
        plu: prod.plu,
        tipoQueso: prod.tipoQueso?.nombre ?? null,
        cantidadFisico: 0,
        cantidadComercial: 0,
      };
      productos.set(prod.id, g);
    }
    return g;
  };

  for (const unidad of unidades) {
    // Aún no existía en la fecha de corte.
    if (new Date(unidad.createdAt).getTime() > corteMs) {
      continue;
    }

    // Ya estaba dada de baja antes (o en) la fecha de corte.
    if (unidad.deletedAt && new Date(unidad.deletedAt).getTime() <= corteMs) {
      continue;
    }

    // Fecha del último corte hecho a la unidad (cuando quedó agotada, suele ser éste).
    const fechasCortes = (unidad.particiones || []).map((p) => new Date(p.createdAt).getTime());
    const ultimoCorteMs = fechasCortes.length ? Math.max(...fechasCortes) : null;

    // ¿Estaba realmente en stock en la fecha de corte?
    const estabaEnStock = unidad.activa
      ? true
      : ultimoCorteMs !== null && ultimoCorteMs > corteMs;

    if (!estabaEnStock) {
      continue;
    }

    // --- La unidad estaba en stock el lunes: la contamos por producto ---
    totalFisico += 1;
    const prod = unidad.producto;
    if (prod) {
      getGrupo(prod).cantidadFisico += 1;
    }

    // --- Movimientos de ESTA unidad desde el corte hasta ahora ---
    const nombreProducto = prod?.nombre ?? 'Producto desconocido';
    const nombreTipo = prod?.tipoQueso?.nombre ?? null;
    const quedoAgotada = !unidad.activa && !unidad.deletedAt;

    const particionesPosteriores = (unidad.particiones || [])
      .filter((p) => {
        const fp = new Date(p.createdAt).getTime();
        return fp > corteMs && fp <= ahoraMs;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const particion of particionesPosteriores) {
      const fp = new Date(particion.createdAt).getTime();
      movimientos.push({
        tipo: 'corte',
        unidadId: unidad.id,
        producto: nombreProducto,
        tipoQueso: nombreTipo,
        peso: Number(particion.peso),
        motivo: particion.motivo?.nombre ?? null,
        fecha: new Date(particion.createdAt).toISOString(),
        agotoUnidad: quedoAgotada && ultimoCorteMs !== null && fp === ultimoCorteMs,
      });
    }

    // Baja (eliminación) posterior al corte.
    if (unidad.deletedAt && new Date(unidad.deletedAt).getTime() > corteMs) {
      movimientos.push({
        tipo: 'baja',
        unidadId: unidad.id,
        producto: nombreProducto,
        tipoQueso: nombreTipo,
        peso: null,
        motivo: null,
        fecha: new Date(unidad.deletedAt).toISOString(),
        agotoUnidad: true,
      });
    }
  }

  // --- Stock comercial (facturación) reconstruido a la fecha de corte ---
  // La cantidad en el corte es el stockNuevo del último movimiento con fecha <= corte
  // (o 0 si no hubo movimientos antes). Se apoya en el historial de movimientos.
  const movsComerciales = await AppDataSource.getRepository(MovimientoStockComercial).find({
    order: { createdAt: 'ASC' },
  });
  const comercialPorProducto = new Map<number, number>();
  for (const mov of movsComerciales) {
    if (new Date(mov.createdAt).getTime() <= corteMs) {
      comercialPorProducto.set(mov.productoId, Number(mov.stockNuevo));
    }
  }

  let totalComercial = 0;
  if (comercialPorProducto.size > 0) {
    const productosInfo = await AppDataSource.getRepository(Producto).find({ relations: ['tipoQueso'] });
    const infoPorId = new Map(productosInfo.map((p) => [p.id, p]));
    for (const [productoId, cantidad] of comercialPorProducto) {
      if (cantidad <= 0) {
        continue;
      }
      totalComercial += cantidad;
      const info = infoPorId.get(productoId);
      if (info) {
        getGrupo(info).cantidadComercial = cantidad;
      } else {
        const g = productos.get(productoId);
        if (g) {
          g.cantidadComercial = cantidad;
        }
      }
    }
  }

  const productosArr = Array.from(productos.values())
    .filter((p) => p.cantidadFisico > 0 || p.cantidadComercial > 0)
    .sort((a, b) => a.producto.localeCompare(b.producto, 'es'));

  movimientos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  return {
    fechaCorte: corte.toISOString(),
    totalFisico,
    totalComercial,
    productos: productosArr,
    movimientos,
  };
}

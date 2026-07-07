import { Between } from 'typeorm';
import { AppDataSource } from '../../../config/database';
import { NotaPedido } from '../entities/NotaPedido';
import { Recibo } from '../entities/Recibo';
import { NotaCredito } from '../entities/NotaCredito';

export interface VentaPorProducto {
  descripcion: string;
  cantidad: number;
  monto: number;
}

export interface CuentaCorrienteItem {
  clienteId: number;
  cliente: string;
  facturado: number;
  cobrado: number;
  saldo: number;
}

export interface ReporteFacturacion {
  periodo: { desde: string | null; hasta: string | null };
  resumen: {
    cantidadNotas: number;
    totalFacturado: number;
    cantidadRecibos: number;
    totalCobrado: number;
    cantidadNotasCredito: number;
    totalCreditado: number;
    saldoPendienteTotal: number;
  };
  ventasPorProducto: VentaPorProducto[];
  cuentaCorriente: CuentaCorrienteItem[];
}

const startOfDay = (d: Date) => {
  const v = new Date(d);
  v.setHours(0, 0, 0, 0);
  return v;
};
const endOfDay = (d: Date) => {
  const v = new Date(d);
  v.setHours(23, 59, 59, 999);
  return v;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Reporte de facturación. Lo del rango (resumen y ventas por producto) usa la fecha del
 * comprobante en [desde, hasta]. La cuenta corriente y el saldo pendiente son la deuda
 * ACTUAL (independiente del rango), para saber quién debe hoy.
 */
export async function computeReporte(desde?: string, hasta?: string): Promise<ReporteFacturacion> {
  const tieneRango = Boolean(desde && hasta);
  const rango = tieneRango
    ? Between(startOfDay(new Date(desde as string)), endOfDay(new Date(hasta as string)))
    : undefined;

  const notaRepo = AppDataSource.getRepository(NotaPedido);
  const reciboRepo = AppDataSource.getRepository(Recibo);
  const ncRepo = AppDataSource.getRepository(NotaCredito);

  // --- Del rango ---
  const notasRango = await notaRepo.find({
    where: rango ? { fecha: rango } : {},
    relations: ['items'],
  });
  const recibosRango = await reciboRepo.find({ where: rango ? { fecha: rango } : {} });
  const ncRango = await ncRepo.find({ where: rango ? { fecha: rango } : {} });

  const totalFacturado = round2(notasRango.reduce((s, n) => s + Number(n.total), 0));
  const totalCobrado = round2(recibosRango.reduce((s, r) => s + Number(r.montoTotal), 0));
  const totalCreditado = round2(ncRango.reduce((s, c) => s + Number(c.montoTotal), 0));

  // Ventas por producto (ítems de las notas del rango)
  const ventasMap = new Map<string, VentaPorProducto>();
  for (const nota of notasRango) {
    for (const item of nota.items || []) {
      const key = item.descripcion;
      const v = ventasMap.get(key) || { descripcion: key, cantidad: 0, monto: 0 };
      v.cantidad += Number(item.cantidad);
      v.monto += Number(item.subtotal);
      ventasMap.set(key, v);
    }
  }
  const ventasPorProducto = Array.from(ventasMap.values())
    .map((v) => ({ ...v, monto: round2(v.monto) }))
    .sort((a, b) => b.monto - a.monto);

  // --- Actual (cuenta corriente y saldo total) ---
  const todasNotas = await notaRepo.find({ relations: ['cliente'] });
  const todosRecibos = await reciboRepo.find();

  const saldoPendienteTotal = round2(todasNotas.reduce((s, n) => s + Number(n.saldoPendiente), 0));

  const ccMap = new Map<number, CuentaCorrienteItem>();
  for (const n of todasNotas) {
    const cid = n.clienteId;
    const cc = ccMap.get(cid) || {
      clienteId: cid,
      cliente: n.cliente?.nombre ?? `Cliente #${cid}`,
      facturado: 0,
      cobrado: 0,
      saldo: 0,
    };
    cc.facturado += Number(n.total);
    cc.saldo += Number(n.saldoPendiente);
    ccMap.set(cid, cc);
  }
  for (const r of todosRecibos) {
    const cc = ccMap.get(r.clienteId);
    if (cc) cc.cobrado += Number(r.montoTotal);
  }
  const cuentaCorriente = Array.from(ccMap.values())
    .map((cc) => ({
      ...cc,
      facturado: round2(cc.facturado),
      cobrado: round2(cc.cobrado),
      saldo: round2(cc.saldo),
    }))
    .sort((a, b) => b.saldo - a.saldo);

  return {
    periodo: { desde: desde ?? null, hasta: hasta ?? null },
    resumen: {
      cantidadNotas: notasRango.length,
      totalFacturado,
      cantidadRecibos: recibosRango.length,
      totalCobrado,
      cantidadNotasCredito: ncRango.length,
      totalCreditado,
      saldoPendienteTotal,
    },
    ventasPorProducto,
    cuentaCorriente,
  };
}

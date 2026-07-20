import { DataSource } from 'typeorm';

// Borra todas las transacciones de facturación (notas de pedido, recibos, notas de
// crédito y stock comercial), reinicia la numeración y reactiva quesos físicos que
// hayan quedado marcados como vendidos en pruebas viejas. CONSERVA clientes,
// proveedores, empresa, productos/precios e inventario físico.
export const SENTENCIAS_LIMPIEZA: string[] = [
  'DELETE FROM "notas_credito_items"',
  'DELETE FROM "notas_credito"',
  'DELETE FROM "recibos_pagos"',
  'DELETE FROM "recibos_aplicaciones"',
  'DELETE FROM "recibos"',
  'DELETE FROM "notas_pedido_items"',
  'DELETE FROM "notas_pedido"',
  'DELETE FROM "movimientos_stock_comercial"',
  'DELETE FROM "stock_comercial"',
  'UPDATE "secuencias_comprobante" SET "ultimoNumero" = 0',
  'UPDATE "unidades" SET "activa" = true, "fechaVenta" = NULL WHERE "fechaVenta" IS NOT NULL',
];

export async function limpiarTransaccionesFacturacion(dataSource: DataSource): Promise<void> {
  for (const sql of SENTENCIAS_LIMPIEZA) {
    try {
      await dataSource.query(sql);
      console.log('🧹', sql);
    } catch (error: any) {
      console.error('⚠️  Se ignora (posible tabla inexistente):', sql, '-', error?.message);
    }
  }
}

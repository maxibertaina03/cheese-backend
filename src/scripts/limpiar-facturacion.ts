// ============================================
// ARCHIVO: src/scripts/limpiar-facturacion.ts
// Borra TODAS las transacciones de facturación (notas de pedido, recibos, notas
// de crédito y stock comercial) dejando intactos clientes, proveedores, empresa,
// productos/precios e inventario físico (pistola).
//
// Ejecutar (una sola vez), tras compilar:
//   node dist/scripts/limpiar-facturacion.js --confirmar
// ============================================
import { AppDataSource } from '../config/database';

// Orden: primero las tablas "hijas". No hay FKs, pero se respeta por prolijidad.
const sentencias = [
  'DELETE FROM "notas_credito_items"',
  'DELETE FROM "notas_credito"',
  'DELETE FROM "recibos_pagos"',
  'DELETE FROM "recibos_aplicaciones"',
  'DELETE FROM "recibos"',
  'DELETE FROM "notas_pedido_items"',
  'DELETE FROM "notas_pedido"',
  'DELETE FROM "movimientos_stock_comercial"',
  'DELETE FROM "stock_comercial"',
  // Reiniciar la numeración de comprobantes (vuelven a arrancar en 1)
  'UPDATE "secuencias_comprobante" SET "ultimoNumero" = 0',
  // Reactivar quesos físicos que hayan quedado marcados como vendidos en pruebas viejas
  'UPDATE "unidades" SET "activa" = true, "fechaVenta" = NULL WHERE "fechaVenta" IS NOT NULL',
];

async function limpiarFacturacion() {
  if (!process.argv.includes('--confirmar')) {
    console.log('⚠️  Este script BORRA todas las transacciones de facturación:');
    console.log('    notas de pedido, recibos, notas de crédito y stock comercial (con su historial).');
    console.log('    Se CONSERVAN: clientes, proveedores, empresa, productos/precios e inventario físico.');
    console.log('');
    console.log('    Para ejecutarlo de verdad, corré:');
    console.log('    node dist/scripts/limpiar-facturacion.js --confirmar');
    return;
  }

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  console.log('🧹 Limpiando transacciones de facturación...');
  for (const sql of sentencias) {
    try {
      await AppDataSource.query(sql);
      console.log('✅', sql);
    } catch (error: any) {
      console.error('⚠️  Se ignora (posible tabla inexistente):', sql, '-', error.message);
    }
  }
  console.log('🎉 Listo. Facturación limpia; clientes y proveedores intactos.');
}

if (require.main === module) {
  limpiarFacturacion()
    .then(async () => {
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
      }
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('❌ Error:', error);
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
      }
      process.exit(1);
    });
}

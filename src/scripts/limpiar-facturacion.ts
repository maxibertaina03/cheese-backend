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
import { limpiarTransaccionesFacturacion } from '../modules/facturacion/services/limpiar.service';

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
  await limpiarTransaccionesFacturacion(AppDataSource);
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

import { EntityManager } from 'typeorm';
import { StockComercial } from '../entities/StockComercial';
import { MovimientoStockComercial } from '../entities/MovimientoStockComercial';
import { Usuario } from '../../../entities/Usuario';

type Tipo = 'ingreso' | 'egreso' | 'ajuste';

const registrarMovimiento = async (
  manager: EntityManager,
  productoId: number,
  tipo: Tipo,
  cantidad: number,
  stockAnterior: number,
  stockNuevo: number,
  referencia: string | null,
  observaciones: string | null,
  usuario: Usuario | null
) => {
  const movRepo = manager.getRepository(MovimientoStockComercial);
  await movRepo.save(
    movRepo.create({
      productoId,
      tipo,
      cantidad,
      stockAnterior,
      stockNuevo,
      referencia,
      observaciones,
      creadoPor: usuario,
    })
  );
};

// Bloquea (o crea) la fila de stock del producto dentro de la transacción dada.
const lockRow = async (manager: EntityManager, productoId: number): Promise<StockComercial> => {
  const repo = manager.getRepository(StockComercial);
  const existente = await repo.findOne({
    where: { productoId },
    lock: { mode: 'pessimistic_write' },
  });
  if (existente) {
    return existente;
  }
  const nueva = repo.create({ productoId, cantidadDisponible: 0 });
  return repo.save(nueva);
};

// Suma cantidad al stock comercial (carga o reingreso por nota de crédito).
export const ingresarStock = async (
  manager: EntityManager,
  productoId: number,
  cantidad: number,
  referencia: string,
  observaciones: string | null,
  usuario: Usuario | null
): Promise<{ stockAnterior: number; stockNuevo: number }> => {
  const row = await lockRow(manager, productoId);
  const stockAnterior = Number(row.cantidadDisponible);
  const stockNuevo = stockAnterior + cantidad;
  row.cantidadDisponible = stockNuevo;
  await manager.getRepository(StockComercial).save(row);
  await registrarMovimiento(manager, productoId, 'ingreso', cantidad, stockAnterior, stockNuevo, referencia, observaciones, usuario);
  return { stockAnterior, stockNuevo };
};

// Descuenta cantidad del stock comercial (venta por nota de pedido).
// Devuelve ok:false con mensaje si no hay stock suficiente.
export const descontarStock = async (
  manager: EntityManager,
  productoId: number,
  cantidad: number,
  referencia: string,
  usuario: Usuario | null
): Promise<{ ok: true; stockAnterior: number; stockNuevo: number } | { ok: false; message: string }> => {
  const row = await lockRow(manager, productoId);
  const stockAnterior = Number(row.cantidadDisponible);
  if (stockAnterior < cantidad) {
    return { ok: false, message: `Stock comercial insuficiente (disponible: ${stockAnterior})` };
  }
  const stockNuevo = stockAnterior - cantidad;
  row.cantidadDisponible = stockNuevo;
  await manager.getRepository(StockComercial).save(row);
  await registrarMovimiento(manager, productoId, 'egreso', cantidad, stockAnterior, stockNuevo, referencia, null, usuario);
  return { ok: true, stockAnterior, stockNuevo };
};

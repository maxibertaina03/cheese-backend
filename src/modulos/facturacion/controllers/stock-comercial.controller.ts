import { Response } from 'express';
import { AppDataSource } from '../../../config/database';
import { Producto } from '../../../entities/Producto';
import { AuthRequest } from '../../../middlewares/auth';
import { getUsuarioActual } from '../../../compartido/utils/usuarioActual';
import { StockComercial } from '../entities/StockComercial';
import { MovimientoStockComercial } from '../entities/MovimientoStockComercial';
import { ingresarStock } from '../services/stock-comercial.service';

export class StockComercialController {
  // Lista todos los productos (quesos) con su cantidad comercial disponible.
  static async getAll(_req: AuthRequest, res: Response) {
    try {
      const productos = await AppDataSource.getRepository(Producto).find({
        relations: ['tipoQueso'],
        order: { nombre: 'ASC' },
      });
      const stocks = await AppDataSource.getRepository(StockComercial).find();
      const porProducto = new Map(stocks.map((s) => [s.productoId, Number(s.cantidadDisponible)]));

      res.json(
        productos.map((p) => ({
          productoId: p.id,
          producto: p.nombre,
          plu: p.plu,
          tipoQueso: p.tipoQueso?.nombre ?? null,
          precioUnitario: p.precioUnitario ?? null,
          cantidadDisponible: porProducto.get(p.id) ?? 0,
        }))
      );
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // Carga cantidad al stock comercial de un producto (compra).
  static async ingreso(req: AuthRequest, res: Response) {
    try {
      const productoId = Number(req.params.productoId);
      const {
        cantidad,
        observaciones,
        fechaComprobante,
        comprobantePrefijo,
        comprobanteNumero,
        precioCompra,
        proveedorId,
      } = req.body as {
        cantidad?: number;
        observaciones?: string | null;
        fechaComprobante?: string | null;
        comprobantePrefijo?: string | null;
        comprobanteNumero?: string | null;
        precioCompra?: number | null;
        proveedorId?: number | null;
      };
      const cantidadNum = Number(cantidad);

      if (!cantidadNum || cantidadNum <= 0) {
        return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
      }

      const producto = await AppDataSource.getRepository(Producto).findOneBy({ id: productoId });
      if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      const resultado = await AppDataSource.transaction(async (manager) => {
        const usuario = await getUsuarioActual(req, manager);
        return ingresarStock(manager, productoId, cantidadNum, 'Carga', observaciones || null, usuario, {
          fechaComprobante: fechaComprobante || null,
          comprobantePrefijo: comprobantePrefijo || null,
          comprobanteNumero: comprobanteNumero || null,
          precioCompra: precioCompra != null && precioCompra !== ('' as any) ? Number(precioCompra) : null,
          proveedorId: proveedorId ? Number(proveedorId) : null,
        });
      });

      res.json({ message: 'Stock cargado correctamente', ...resultado });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // Historial completo de movimientos de todos los productos (para análisis de compras).
  static async getAllMovimientos(_req: AuthRequest, res: Response) {
    try {
      const movimientos = await AppDataSource.getRepository(MovimientoStockComercial).find({
        relations: ['producto', 'producto.tipoQueso', 'proveedor', 'creadoPor'],
        order: { createdAt: 'DESC' },
      });
      // Mapeo seguro: no exponemos el objeto Usuario completo (evita filtrar el hash).
      res.json(
        movimientos.map((m) => ({
          id: m.id,
          productoId: m.productoId,
          producto: m.producto?.nombre ?? null,
          plu: m.producto?.plu ?? null,
          tipoQueso: m.producto?.tipoQueso?.nombre ?? null,
          tipo: m.tipo,
          cantidad: m.cantidad,
          stockAnterior: m.stockAnterior,
          stockNuevo: m.stockNuevo,
          referencia: m.referencia,
          observaciones: m.observaciones,
          fechaComprobante: m.fechaComprobante,
          comprobantePrefijo: m.comprobantePrefijo,
          comprobanteNumero: m.comprobanteNumero,
          precioCompra: m.precioCompra,
          proveedorId: m.proveedorId,
          proveedor: m.proveedor?.nombre ?? null,
          usuario: m.creadoPor ? { id: m.creadoPor.id, username: m.creadoPor.username } : null,
          createdAt: m.createdAt,
        }))
      );
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // Elimina una compra (movimiento de ingreso) y revierte el stock. Solo aplica a
  // ingresos; las ventas/ajustes se corrigen por otros medios (nota de crédito, etc.).
  static async eliminarMovimiento(req: AuthRequest, res: Response) {
    try {
      const id = Number(req.params.id);

      type Resultado = { error: { status: number; msg: string } } | { ok: true };
      const resultado: Resultado = await AppDataSource.transaction(async (manager): Promise<Resultado> => {
        const movRepo = manager.getRepository(MovimientoStockComercial);
        const mov = await movRepo.findOneBy({ id });
        if (!mov) {
          return { error: { status: 404, msg: 'Movimiento no encontrado' } };
        }
        if (mov.tipo !== 'ingreso') {
          return { error: { status: 400, msg: 'Solo se pueden eliminar compras (ingresos)' } };
        }

        const cantidad = Number(mov.cantidad);
        const stockRepo = manager.getRepository(StockComercial);
        const stock = await stockRepo.findOne({
          where: { productoId: mov.productoId },
          lock: { mode: 'pessimistic_write' },
        });
        const disponible = stock ? Number(stock.cantidadDisponible) : 0;

        // No se puede revertir si ya no queda stock suficiente (parte ya se vendió).
        if (disponible < cantidad) {
          return {
            error: {
              status: 400,
              msg: `No se puede eliminar: el stock disponible (${disponible}) es menor que la cantidad de la compra (${cantidad}). Probablemente ya se vendió parte de ese stock.`,
            },
          };
        }

        if (stock) {
          stock.cantidadDisponible = disponible - cantidad;
          await stockRepo.save(stock);
        }
        await movRepo.remove(mov);
        return { ok: true };
      });

      if ('error' in resultado) {
        return res.status(resultado.error.status).json({ error: resultado.error.msg });
      }

      res.json({ message: 'Compra eliminada y stock actualizado' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getMovimientos(req: AuthRequest, res: Response) {
    try {
      const productoId = Number(req.params.productoId);
      const movimientos = await AppDataSource.getRepository(MovimientoStockComercial).find({
        where: { productoId },
        relations: ['creadoPor'],
        order: { createdAt: 'DESC' },
      });
      res.json(movimientos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

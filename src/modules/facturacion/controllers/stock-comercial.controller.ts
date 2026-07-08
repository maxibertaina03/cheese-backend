import { Response } from 'express';
import { AppDataSource } from '../../../config/database';
import { Producto } from '../../../entities/Producto';
import { Usuario } from '../../../entities/Usuario';
import { AuthRequest } from '../../../middlewares/auth';
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
        let usuario: Usuario | null = null;
        if (req.user?.id) {
          usuario = await manager.getRepository(Usuario).findOneBy({ id: req.user.id });
        }
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

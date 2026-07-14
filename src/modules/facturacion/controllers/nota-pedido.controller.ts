import { Response } from 'express';
import { AppDataSource } from '../../../config/database';
import { Elemento } from '../../../entities/Elemento';
import { MovimientoElemento } from '../../../entities/MovimientoElemento';
import { Producto } from '../../../entities/Producto';
import { Usuario } from '../../../entities/Usuario';
import { AuthRequest } from '../../../middlewares/auth';
import { Cliente } from '../entities/Cliente';
import { NotaPedido } from '../entities/NotaPedido';
import { NotaPedidoItem } from '../entities/NotaPedidoItem';
import { SecuenciaComprobante } from '../entities/SecuenciaComprobante';
import { descontarStock } from '../services/stock-comercial.service';

const TIPO_NOTA_PEDIDO = 1;

type ControllerError = { error: { status: number; payload: { error: string } } };

const isError = (value: unknown): value is ControllerError =>
  typeof value === 'object' && value !== null && 'error' in value;

const fail = (status: number, message: string): ControllerError => ({
  error: { status, payload: { error: message } },
});

export class NotaPedidoController {
  static async getAll(_req: AuthRequest, res: Response) {
    try {
      const notaRepo = AppDataSource.getRepository(NotaPedido);
      const notas = await notaRepo.find({
        relations: ['cliente'],
        order: { fecha: 'DESC' },
      });
      res.json(notas);
    } catch (error: any) {
      console.error('❌ Error en getAll notas-pedido:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getOne(req: AuthRequest, res: Response) {
    try {
      const notaRepo = AppDataSource.getRepository(NotaPedido);
      const nota = await notaRepo.findOne({
        where: { id: Number(req.params.id) },
        relations: ['cliente', 'items', 'items.producto', 'items.elemento'],
      });
      if (!nota) {
        return res.status(404).json({ error: 'Nota de pedido no encontrada' });
      }
      res.json(nota);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      const { clienteId, observaciones, items, fecha } = req.body as {
        clienteId?: number;
        observaciones?: string | null;
        fecha?: string | null;
        items?: Array<{ tipoItem: 'queso' | 'elemento'; productoId?: number; elementoId?: number; cantidad?: number }>;
      };

      if (!clienteId) {
        return res.status(400).json({ error: 'El cliente es obligatorio' });
      }

      // Fecha del comprobante: si viene 'YYYY-MM-DD', se guarda a mediodía UTC para
      // que no se corra un día al mostrarla en zonas horarias negativas (ej. AR).
      const fechaComprobante = fecha ? new Date(`${String(fecha).slice(0, 10)}T12:00:00Z`) : undefined;
      if (fecha && Number.isNaN(fechaComprobante!.getTime())) {
        return res.status(400).json({ error: 'La fecha de la nota no es válida' });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'La nota debe tener al menos un ítem' });
      }

      const result = await AppDataSource.transaction(async (manager) => {
        const cliente = await manager.getRepository(Cliente).findOneBy({ id: clienteId });
        if (!cliente) {
          return fail(404, 'Cliente no encontrado');
        }

        let usuarioCreador: Usuario | null = null;
        if (req.user?.id) {
          usuarioCreador = await manager.getRepository(Usuario).findOneBy({ id: req.user.id });
        }

        // Numeración atómica primero: si un ítem falla, la transacción revierte y no se consume número.
        const secRepo = manager.getRepository(SecuenciaComprobante);
        let sec = await secRepo.findOne({
          where: { tipo: TIPO_NOTA_PEDIDO },
          lock: { mode: 'pessimistic_write' },
        });
        if (!sec) {
          sec = secRepo.create({ tipo: TIPO_NOTA_PEDIDO, prefijo: '1', ultimoNumero: 0 });
        }
        sec.ultimoNumero = Number(sec.ultimoNumero) + 1;
        await secRepo.save(sec);
        const referencia = `NP ${sec.prefijo}-${sec.ultimoNumero}`;

        const elementoRepo = manager.getRepository(Elemento);
        let total = 0;
        const itemsData: Partial<NotaPedidoItem>[] = [];
        const egresosElemento: Array<{ elemento: Elemento; cantidad: number; stockAnterior: number; stockNuevo: number }> = [];

        for (const it of items) {
          const cantidad = Number(it.cantidad);
          if (!cantidad || cantidad <= 0) {
            return fail(400, 'La cantidad debe ser mayor a 0');
          }

          if (it.tipoItem === 'queso') {
            const producto = await manager.getRepository(Producto).findOneBy({ id: it.productoId });
            if (!producto) {
              return fail(404, `Producto #${it.productoId} no encontrado`);
            }
            const precio = producto.precioUnitario;
            if (precio === null || precio === undefined) {
              return fail(400, `El producto "${producto.nombre}" no tiene precio por unidad cargado`);
            }

            const descuento = await descontarStock(manager, producto.id, cantidad, referencia, usuarioCreador);
            if (!descuento.ok) {
              return fail(400, `${producto.nombre}: ${descuento.message}`);
            }

            const precioNum = Number(precio);
            const subtotal = precioNum * cantidad;
            total += subtotal;
            itemsData.push({
              tipoItem: 'queso',
              producto,
              elemento: null,
              descripcion: producto.nombre,
              plu: producto.plu,
              cantidad,
              precioUnitario: precioNum,
              subtotal,
            });
          } else if (it.tipoItem === 'elemento') {
            const elemento = await elementoRepo.findOne({
              where: { id: it.elementoId },
              lock: { mode: 'pessimistic_write' },
            });
            if (!elemento) {
              return fail(404, `Elemento #${it.elementoId} no encontrado`);
            }
            if (!elemento.esVendible) {
              return fail(400, `El elemento "${elemento.nombre}" no está marcado como vendible`);
            }
            const stockAnterior = Number(elemento.cantidadDisponible);
            if (stockAnterior < cantidad) {
              return fail(400, `Stock insuficiente de "${elemento.nombre}" (disponible: ${stockAnterior})`);
            }

            const stockNuevo = stockAnterior - cantidad;
            elemento.cantidadDisponible = stockNuevo;
            if (stockNuevo === 0) {
              elemento.activo = false;
            }
            await elementoRepo.save(elemento);

            const precioNum = Number(elemento.precioUnitario);
            const subtotal = precioNum * cantidad;
            total += subtotal;
            egresosElemento.push({ elemento, cantidad, stockAnterior, stockNuevo });
            itemsData.push({
              tipoItem: 'elemento',
              producto: null,
              elemento,
              descripcion: elemento.nombre,
              plu: null,
              cantidad,
              precioUnitario: precioNum,
              subtotal,
            });
          } else {
            return fail(400, 'Tipo de ítem inválido');
          }
        }

        const totalRedondeado = Math.round(total * 100) / 100;

        const notaRepo = manager.getRepository(NotaPedido);
        const nota = notaRepo.create({
          serie: sec.prefijo,
          numero: sec.ultimoNumero,
          cliente,
          total: totalRedondeado,
          saldoPendiente: totalRedondeado,
          estado: 'confirmada',
          observaciones: observaciones || null,
          creadoPor: usuarioCreador,
          ...(fechaComprobante ? { fecha: fechaComprobante } : {}),
        });
        await notaRepo.save(nota);

        const itemRepo = manager.getRepository(NotaPedidoItem);
        for (const data of itemsData) {
          await itemRepo.save(itemRepo.create({ ...data, notaPedido: nota }));
        }

        // Movimientos de egreso de los elementos vendidos (referencian la nota)
        const movRepo = manager.getRepository(MovimientoElemento);
        for (const eg of egresosElemento) {
          await movRepo.save(
            movRepo.create({
              elemento: eg.elemento,
              tipo: 'egreso',
              cantidad: eg.cantidad,
              stockAnterior: eg.stockAnterior,
              stockNuevo: eg.stockNuevo,
              observaciones: `Venta ${referencia}`,
              creadoPor: usuarioCreador,
            })
          );
        }

        return { notaId: nota.id };
      });

      if (isError(result)) {
        return res.status(result.error.status).json(result.error.payload);
      }

      const notaCompleta = await AppDataSource.getRepository(NotaPedido).findOne({
        where: { id: result.notaId },
        relations: ['cliente', 'items'],
      });
      res.status(201).json(notaCompleta);
    } catch (error: any) {
      console.error('❌ Error en create nota-pedido:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

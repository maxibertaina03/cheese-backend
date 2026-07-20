import { Response } from 'express';
import { In } from 'typeorm';
import { AppDataSource } from '../../../config/database';
import { Elemento } from '../../elementos/entities/Elemento';
import { MovimientoElemento } from '../../elementos/entities/MovimientoElemento';
import { AuthRequest } from '../../../middlewares/auth';
import { getUsuarioActual } from '../../../compartido/utils/usuarioActual';
import { NotaCredito } from '../entities/NotaCredito';
import { NotaCreditoItem } from '../entities/NotaCreditoItem';
import { NotaPedido } from '../entities/NotaPedido';
import { NotaPedidoItem } from '../entities/NotaPedidoItem';
import { SecuenciaComprobante } from '../entities/SecuenciaComprobante';
import { ingresarStock } from '../services/stock-comercial.service';

const TIPO_NOTA_CREDITO = 3;

type ControllerError = { error: { status: number; payload: { error: string } } };
const isError = (v: unknown): v is ControllerError =>
  typeof v === 'object' && v !== null && 'error' in v;
const fail = (status: number, message: string): ControllerError => ({
  error: { status, payload: { error: message } },
});

export class NotaCreditoController {
  static async getAll(_req: AuthRequest, res: Response) {
    try {
      const notas = await AppDataSource.getRepository(NotaCredito).find({
        relations: ['notaPedido', 'cliente'],
        order: { fecha: 'DESC' },
      });
      res.json(notas);
    } catch (error: any) {
      console.error('❌ Error en getAll notas-credito:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getOne(req: AuthRequest, res: Response) {
    try {
      const nota = await AppDataSource.getRepository(NotaCredito).findOne({
        where: { id: Number(req.params.id) },
        relations: ['notaPedido', 'cliente', 'items'],
      });
      if (!nota) {
        return res.status(404).json({ error: 'Nota de crédito no encontrada' });
      }
      res.json(nota);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // Devuelve la nota de pedido + sus ítems con lo que se puede devolver (disponible).
  static async getNotaParaDevolver(req: AuthRequest, res: Response) {
    try {
      const notaPedidoId = Number(req.params.notaPedidoId);
      const nota = await AppDataSource.getRepository(NotaPedido).findOne({
        where: { id: notaPedidoId },
        relations: ['cliente'],
      });
      if (!nota) {
        return res.status(404).json({ error: 'Nota de pedido no encontrada' });
      }

      const items = await AppDataSource.getRepository(NotaPedidoItem).find({ where: { notaPedidoId } });
      const itemIds = items.map((i) => i.id);
      const ncItems = itemIds.length
        ? await AppDataSource.getRepository(NotaCreditoItem).find({ where: { notaPedidoItemId: In(itemIds) } })
        : [];
      const devuelto = new Map<number, number>();
      for (const nci of ncItems) {
        devuelto.set(nci.notaPedidoItemId, (devuelto.get(nci.notaPedidoItemId) ?? 0) + Number(nci.cantidad));
      }

      res.json({
        id: nota.id,
        serie: nota.serie,
        numero: nota.numero,
        cliente: nota.cliente,
        estado: nota.estado,
        total: nota.total,
        items: items.map((i) => {
          const yaDevuelto = devuelto.get(i.id) ?? 0;
          return {
            notaPedidoItemId: i.id,
            tipoItem: i.tipoItem,
            descripcion: i.descripcion,
            plu: i.plu,
            cantidad: i.cantidad,
            cantidadDevuelta: yaDevuelto,
            disponible: i.cantidad - yaDevuelto,
            precioUnitario: Number(i.precioUnitario),
          };
        }),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      const { notaPedidoId, motivo, items } = req.body as {
        notaPedidoId?: number;
        motivo?: string | null;
        items?: Array<{ notaPedidoItemId: number; cantidad: number }>;
      };

      if (!notaPedidoId) {
        return res.status(400).json({ error: 'La nota de pedido es obligatoria' });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Hay que devolver al menos un ítem' });
      }

      const result = await AppDataSource.transaction(async (manager) => {
        // Bloquear la nota SOLA (sin relaciones: evita FOR UPDATE sobre outer join).
        const notaRepo = manager.getRepository(NotaPedido);
        const nota = await notaRepo.findOne({
          where: { id: notaPedidoId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!nota) {
          return fail(404, 'Nota de pedido no encontrada');
        }
        if (nota.estado === 'anulada') {
          return fail(400, 'La nota de pedido ya está anulada');
        }

        const usuario = await getUsuarioActual(req, manager);

        // Ítems de la nota + lo ya devuelto por ítem
        const notaItems = await manager.getRepository(NotaPedidoItem).find({ where: { notaPedidoId } });
        const itemsById = new Map(notaItems.map((i) => [i.id, i]));
        const itemIds = notaItems.map((i) => i.id);
        const ncItemRepo = manager.getRepository(NotaCreditoItem);
        const previos = itemIds.length ? await ncItemRepo.find({ where: { notaPedidoItemId: In(itemIds) } }) : [];
        const devueltoPorItem = new Map<number, number>();
        for (const p of previos) {
          devueltoPorItem.set(p.notaPedidoItemId, (devueltoPorItem.get(p.notaPedidoItemId) ?? 0) + Number(p.cantidad));
        }

        // Numeración serie 3
        const secRepo = manager.getRepository(SecuenciaComprobante);
        let sec = await secRepo.findOne({ where: { tipo: TIPO_NOTA_CREDITO }, lock: { mode: 'pessimistic_write' } });
        if (!sec) {
          sec = secRepo.create({ tipo: TIPO_NOTA_CREDITO, prefijo: '3', ultimoNumero: 0 });
        }
        sec.ultimoNumero = Number(sec.ultimoNumero) + 1;
        await secRepo.save(sec);
        const referencia = `NC ${sec.prefijo}-${sec.ultimoNumero}`;

        const elementoRepo = manager.getRepository(Elemento);
        const movElementoRepo = manager.getRepository(MovimientoElemento);
        let montoTotal = 0;
        const ncItemsData: Partial<NotaCreditoItem>[] = [];
        // Acumula devoluciones dentro de este mismo request (por si repiten ítem)
        const devueltoEnEsta = new Map<number, number>();

        for (const dev of items) {
          const cantidad = Number(dev.cantidad);
          if (!cantidad || cantidad <= 0) {
            return fail(400, 'Cada cantidad a devolver debe ser mayor a 0');
          }
          const item = itemsById.get(dev.notaPedidoItemId);
          if (!item) {
            return fail(404, `Ítem #${dev.notaPedidoItemId} no pertenece a esta nota`);
          }
          const yaDevuelto = (devueltoPorItem.get(item.id) ?? 0) + (devueltoEnEsta.get(item.id) ?? 0);
          const disponible = item.cantidad - yaDevuelto;
          if (cantidad > disponible) {
            return fail(400, `No se puede devolver ${cantidad} de "${item.descripcion}" (disponible: ${disponible})`);
          }
          devueltoEnEsta.set(item.id, (devueltoEnEsta.get(item.id) ?? 0) + cantidad);

          // Reingreso de stock según el tipo
          if (item.tipoItem === 'queso' && item.productoId != null) {
            await ingresarStock(manager, item.productoId, cantidad, referencia, `Devolución ${referencia}`, usuario);
          } else if (item.tipoItem === 'elemento' && item.elementoId != null) {
            const elemento = await elementoRepo.findOne({
              where: { id: item.elementoId },
              lock: { mode: 'pessimistic_write' },
            });
            if (elemento) {
              const stockAnterior = Number(elemento.cantidadDisponible);
              const stockNuevo = stockAnterior + cantidad;
              elemento.cantidadDisponible = stockNuevo;
              elemento.activo = true;
              await elementoRepo.save(elemento);
              await movElementoRepo.save(
                movElementoRepo.create({
                  elemento,
                  tipo: 'ingreso',
                  cantidad,
                  stockAnterior,
                  stockNuevo,
                  observaciones: `Devolución ${referencia}`,
                  creadoPor: usuario,
                })
              );
            }
          }

          const precioNum = Number(item.precioUnitario);
          const subtotal = precioNum * cantidad;
          montoTotal += subtotal;
          ncItemsData.push({
            notaPedidoItemId: item.id,
            tipoItem: item.tipoItem,
            productoId: item.productoId,
            elementoId: item.elementoId,
            descripcion: item.descripcion,
            plu: item.plu,
            cantidad,
            precioUnitario: precioNum,
            subtotal,
          });
        }

        const montoRedondeado = Math.round(montoTotal * 100) / 100;

        // Total ya acreditado antes de esta nota
        const notaTotal = Number(nota.total);
        const creditosPrevios = await manager.getRepository(NotaCredito).find({ where: { notaPedidoId } });
        const totalCreditado = creditosPrevios.reduce((s, c) => s + Number(c.montoTotal), 0) + montoRedondeado;

        // Bajar saldo y recalcular estado
        const saldoNuevo = Math.max(0, Math.round((Number(nota.saldoPendiente) - montoRedondeado) * 100) / 100);
        nota.saldoPendiente = saldoNuevo;
        if (totalCreditado >= notaTotal - 0.001) {
          nota.estado = 'anulada';
        } else if (saldoNuevo <= 0.001) {
          nota.estado = 'pagada_total';
        } else if (saldoNuevo < notaTotal) {
          nota.estado = 'pagada_parcial';
        } else {
          nota.estado = 'confirmada';
        }
        await notaRepo.save(nota);

        const ncRepo = manager.getRepository(NotaCredito);
        const nc = ncRepo.create({
          serie: sec.prefijo,
          numero: sec.ultimoNumero,
          notaPedidoId: nota.id,
          clienteId: nota.clienteId,
          montoTotal: montoRedondeado,
          motivo: motivo || null,
          creadoPor: usuario,
        });
        await ncRepo.save(nc);

        for (const data of ncItemsData) {
          await ncItemRepo.save(ncItemRepo.create({ ...data, notaCreditoId: nc.id }));
        }

        return { notaCreditoId: nc.id };
      });

      if (isError(result)) {
        return res.status(result.error.status).json(result.error.payload);
      }

      const ncCompleta = await AppDataSource.getRepository(NotaCredito).findOne({
        where: { id: result.notaCreditoId },
        relations: ['notaPedido', 'cliente', 'items'],
      });
      res.status(201).json(ncCompleta);
    } catch (error: any) {
      console.error('❌ Error en create nota-credito:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

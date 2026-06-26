import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Cliente } from '../entities/Cliente';
import { Elemento } from '../entities/Elemento';
import { MovimientoElemento } from '../entities/MovimientoElemento';
import { NotaPedido } from '../entities/NotaPedido';
import { NotaPedidoItem } from '../entities/NotaPedidoItem';
import { SecuenciaComprobante } from '../entities/SecuenciaComprobante';
import { Unidad } from '../entities/Unidad';
import { Usuario } from '../entities/Usuario';
import { AuthRequest } from '../middlewares/auth';

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
        relations: ['cliente', 'items', 'items.unidad', 'items.unidad.producto', 'items.elemento'],
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
      const { clienteId, observaciones, items } = req.body as {
        clienteId?: number;
        observaciones?: string | null;
        items?: Array<{ tipoItem: 'queso' | 'elemento'; unidadId?: number; elementoId?: number; cantidad?: number }>;
      };

      if (!clienteId) {
        return res.status(400).json({ error: 'El cliente es obligatorio' });
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

        const unidadRepo = manager.getRepository(Unidad);
        const elementoRepo = manager.getRepository(Elemento);

        const now = new Date();
        let total = 0;
        const itemsData: Partial<NotaPedidoItem>[] = [];
        const egresosElemento: Array<{ elemento: Elemento; cantidad: number; stockAnterior: number; stockNuevo: number }> = [];

        for (const it of items) {
          if (it.tipoItem === 'queso') {
            const unidad = await unidadRepo.findOne({
              where: { id: it.unidadId },
              relations: ['producto'],
              lock: { mode: 'pessimistic_write' },
            });
            if (!unidad) {
              return fail(404, `Queso #${it.unidadId} no encontrado`);
            }
            if (!unidad.activa || unidad.fechaVenta) {
              return fail(400, `El queso #${unidad.id} ya no está disponible`);
            }
            if (Number(unidad.pesoActual) !== Number(unidad.pesoInicial)) {
              return fail(400, `Solo se pueden vender quesos enteros (el #${unidad.id} ya está empezado)`);
            }
            const precio = unidad.producto?.precioUnitario;
            if (precio === null || precio === undefined) {
              return fail(400, `El producto "${unidad.producto?.nombre ?? ''}" no tiene precio por unidad cargado`);
            }

            unidad.activa = false;
            unidad.fechaVenta = now;
            await unidadRepo.save(unidad);

            const precioNum = Number(precio);
            total += precioNum;
            itemsData.push({
              tipoItem: 'queso',
              unidad,
              elemento: null,
              descripcion: unidad.producto?.nombre ?? 'Queso',
              plu: unidad.producto?.plu ?? null,
              pesoGramos: Number(unidad.pesoInicial),
              fechaElaboracion: unidad.fechaElaboracion,
              cantidad: 1,
              precioUnitario: precioNum,
              subtotal: precioNum,
            });
          } else if (it.tipoItem === 'elemento') {
            const cantidad = Number(it.cantidad);
            if (!cantidad || cantidad <= 0) {
              return fail(400, 'La cantidad del elemento debe ser mayor a 0');
            }
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
              unidad: null,
              elemento,
              descripcion: elemento.nombre,
              plu: null,
              pesoGramos: null,
              fechaElaboracion: null,
              cantidad,
              precioUnitario: precioNum,
              subtotal,
            });
          } else {
            return fail(400, 'Tipo de ítem inválido');
          }
        }

        // Numeración atómica (bloquea la fila de la secuencia)
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
              observaciones: `Venta NP ${sec.prefijo}-${sec.ultimoNumero}`,
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

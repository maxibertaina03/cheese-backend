import { Response } from 'express';
import { AppDataSource } from '../../../config/database';
import { Usuario } from '../../../entities/Usuario';
import { AuthRequest } from '../../../middlewares/auth';
import { Cliente } from '../entities/Cliente';
import { NotaPedido } from '../entities/NotaPedido';
import { Recibo } from '../entities/Recibo';
import { ReciboAplicacion } from '../entities/ReciboAplicacion';
import { ReciboPago } from '../entities/ReciboPago';
import { SecuenciaComprobante } from '../entities/SecuenciaComprobante';

const TIPO_RECIBO = 2;

type ControllerError = { error: { status: number; payload: { error: string } } };

const isError = (value: unknown): value is ControllerError =>
  typeof value === 'object' && value !== null && 'error' in value;

const fail = (status: number, message: string): ControllerError => ({
  error: { status, payload: { error: message } },
});

export class ReciboController {
  static async getAll(_req: AuthRequest, res: Response) {
    try {
      const recibos = await AppDataSource.getRepository(Recibo).find({
        relations: ['cliente'],
        order: { fecha: 'DESC' },
      });
      res.json(recibos);
    } catch (error: any) {
      console.error('❌ Error en getAll recibos:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getOne(req: AuthRequest, res: Response) {
    try {
      const recibo = await AppDataSource.getRepository(Recibo).findOne({
        where: { id: Number(req.params.id) },
        relations: ['cliente', 'aplicaciones', 'aplicaciones.notaPedido', 'pagos'],
      });
      if (!recibo) {
        return res.status(404).json({ error: 'Recibo no encontrado' });
      }
      res.json(recibo);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      const { clienteId, observaciones, aplicaciones, pagos } = req.body as {
        clienteId?: number;
        observaciones?: string | null;
        aplicaciones?: Array<{ notaPedidoId: number; monto: number }>;
        pagos?: Array<{ medio: 'efectivo' | 'transferencia'; monto: number }>;
      };

      if (!clienteId) {
        return res.status(400).json({ error: 'El cliente es obligatorio' });
      }
      if (!Array.isArray(aplicaciones) || aplicaciones.length === 0) {
        return res.status(400).json({ error: 'El recibo debe aplicarse al menos a una nota' });
      }
      if (!Array.isArray(pagos) || pagos.length === 0) {
        return res.status(400).json({ error: 'Indicá al menos una forma de pago' });
      }
      for (const p of pagos) {
        if ((p.medio !== 'efectivo' && p.medio !== 'transferencia') || Number(p.monto) <= 0) {
          return res.status(400).json({ error: 'Forma de pago inválida' });
        }
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

        // Numeración atómica de la serie de recibos (tipo 2)
        const secRepo = manager.getRepository(SecuenciaComprobante);
        let sec = await secRepo.findOne({
          where: { tipo: TIPO_RECIBO },
          lock: { mode: 'pessimistic_write' },
        });
        if (!sec) {
          sec = secRepo.create({ tipo: TIPO_RECIBO, prefijo: '2', ultimoNumero: 0 });
        }
        sec.ultimoNumero = Number(sec.ultimoNumero) + 1;
        await secRepo.save(sec);

        const notaRepo = manager.getRepository(NotaPedido);
        let montoTotal = 0;
        const aplicacionesData: Partial<ReciboAplicacion>[] = [];

        for (const ap of aplicaciones) {
          const monto = Number(ap.monto);
          if (!monto || monto <= 0) {
            return fail(400, 'Cada monto aplicado debe ser mayor a 0');
          }

          const nota = await notaRepo.findOne({
            where: { id: ap.notaPedidoId },
            lock: { mode: 'pessimistic_write' },
          });
          if (!nota) {
            return fail(404, `Nota de pedido #${ap.notaPedidoId} no encontrada`);
          }
          if (nota.clienteId !== clienteId) {
            return fail(400, `La nota ${nota.serie}-${nota.numero} no es de este cliente`);
          }
          if (nota.estado === 'anulada') {
            return fail(400, `La nota ${nota.serie}-${nota.numero} está anulada`);
          }

          const saldoActual = Number(nota.saldoPendiente);
          if (monto > saldoActual + 0.001) {
            return fail(400, `El monto supera el saldo de la nota ${nota.serie}-${nota.numero} (saldo: ${saldoActual.toFixed(2)})`);
          }

          const saldoNuevo = Math.round((saldoActual - monto) * 100) / 100;
          nota.saldoPendiente = saldoNuevo;
          nota.estado = saldoNuevo <= 0.001 ? 'pagada_total' : 'pagada_parcial';
          await notaRepo.save(nota);

          montoTotal += monto;
          aplicacionesData.push({
            notaPedidoId: nota.id,
            numeroNota: `${nota.serie}-${nota.numero}`,
            monto,
            saldoPosterior: saldoNuevo,
          });
        }

        const montoRedondeado = Math.round(montoTotal * 100) / 100;

        // Las formas de pago deben sumar exactamente lo aplicado a las notas.
        const totalPagos = Math.round((pagos as Array<{ monto: number }>).reduce((s, p) => s + Number(p.monto), 0) * 100) / 100;
        if (Math.abs(totalPagos - montoRedondeado) > 0.01) {
          return fail(400, `Las formas de pago (${totalPagos.toFixed(2)}) no coinciden con el total a cobrar (${montoRedondeado.toFixed(2)})`);
        }

        const medios = new Set((pagos as Array<{ medio: string }>).map((p) => p.medio));
        const medioPagoRecibo = medios.size > 1 ? 'mixto' : (pagos as Array<{ medio: 'efectivo' | 'transferencia' }>)[0].medio;

        const reciboRepo = manager.getRepository(Recibo);
        const recibo = reciboRepo.create({
          serie: sec.prefijo,
          numero: sec.ultimoNumero,
          cliente,
          clienteId,
          montoTotal: montoRedondeado,
          medioPago: medioPagoRecibo,
          observaciones: observaciones || null,
          creadoPor: usuarioCreador,
        });
        await reciboRepo.save(recibo);

        const aplicacionRepo = manager.getRepository(ReciboAplicacion);
        for (const data of aplicacionesData) {
          await aplicacionRepo.save(aplicacionRepo.create({ ...data, reciboId: recibo.id }));
        }

        const pagoRepo = manager.getRepository(ReciboPago);
        for (const p of pagos as Array<{ medio: 'efectivo' | 'transferencia'; monto: number }>) {
          await pagoRepo.save(pagoRepo.create({ reciboId: recibo.id, medio: p.medio, monto: Number(p.monto) }));
        }

        return { reciboId: recibo.id };
      });

      if (isError(result)) {
        return res.status(result.error.status).json(result.error.payload);
      }

      const reciboCompleto = await AppDataSource.getRepository(Recibo).findOne({
        where: { id: result.reciboId },
        relations: ['cliente', 'aplicaciones'],
      });
      res.status(201).json(reciboCompleto);
    } catch (error: any) {
      console.error('❌ Error en create recibo:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

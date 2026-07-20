import { Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Brackets, SelectQueryBuilder } from 'typeorm';
import { AppDataSource } from '../../../config/database';
import { Indumentaria } from '../../indumentaria/entities/Indumentaria';
import { MovimientoIndumentaria } from '../../indumentaria/entities/MovimientoIndumentaria';
import { Empresa } from '../../facturacion/entities/Empresa';
import { NotaPedido } from '../../facturacion/entities/NotaPedido';
import { NotaCredito } from '../../facturacion/entities/NotaCredito';
import { Recibo } from '../../facturacion/entities/Recibo';
import { computeReporte } from '../../facturacion/services/reporte-facturacion.service';
import { Particion } from '../../inventario-quesos/entities/Particion';
import { Unidad } from '../../inventario-quesos/entities/Unidad';
import { AuthRequest } from '../../../middlewares/auth';
import { computeStockAlCorte, getUltimoLunes } from '../../inventario-quesos/services/stockAlCorte.service';
import { formatDateLabel } from '../../../compartido/utils/fechas';
import {
  PdfColumn,
  buildPdfBuffer,
  drawPdfFooter,
  drawPdfTableHeader,
  drawReportHeader,
  drawSectionTitle,
  drawSimpleTable,
  drawSummaryCards,
  ensurePdfSpace,
  textOrDash,
  truncateText,
} from '../../../compartido/utils/pdf';
import { RawVenta, RawTopProducto, RawInventario, DashboardVenta, DashboardTopProducto, DashboardInventario, DateRange, DashboardPeriod, DashboardSnapshot, IndumentariaSnapshot, InventarioPdfQuery, HistorialPdfQuery, toNumber, startOfDay, endOfDay, formatVenta, formatTopProducto, formatInventarioActual, formatInventarioValorizado, formatDateParam, formatKg, formatKgLabel, normalizeSearch, parseOptionalRange } from '../reportes-comunes';

export class ComprobantesPdfController {
  static async exportNotaPedidoPdf(req: AuthRequest, res: Response) {
    try {
      const notaRepo = AppDataSource.getRepository(NotaPedido);
      const nota = await notaRepo.findOne({
        where: { id: Number(req.params.id) },
        relations: ['cliente', 'items'],
      });

      if (!nota) {
        return res.status(404).json({ error: 'Nota de pedido no encontrada' });
      }

      const empresa = await AppDataSource.getRepository(Empresa).findOne({
        where: {},
        order: { id: 'ASC' },
      });

      const numeroComprobante = `${nota.serie}-${nota.numero}`;
      const pesos = (n: number | string | null | undefined) =>
        `$ ${toNumber(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      // Sin bufferPages: layout propio de una sola página (footer manual).
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const bufferPromise = buildPdfBuffer(doc);

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const contentW = right - left;
      const top = doc.page.margins.top;

      // ----- Encabezado: emisor a la izquierda, comprobante a la derecha -----
      const headerH = 86;
      const splitX = left + contentW * 0.58;
      doc.save();
      doc.roundedRect(left, top, contentW, headerH, 6).fill('#111827');
      doc.restore();

      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(empresa?.razonSocial || 'Mi empresa', left + 16, top + 13, { width: splitX - left - 24 });
      const emisorInfo = [
        [empresa?.cuit ? `CUIT ${empresa.cuit}` : null, empresa?.condicionIva].filter(Boolean).join(' · '),
        empresa?.direccion,
        [empresa?.codigoPostal, empresa?.localidad, empresa?.provincia].filter(Boolean).join(' '),
        empresa?.telefono ? `Tel ${empresa.telefono}` : null,
      ]
        .filter(Boolean)
        .join('\n');
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#cbd5e1')
        .text(emisorInfo, left + 16, top + 38, { width: splitX - left - 24, lineGap: 1.5 });

      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('NOTA DE PEDIDO', splitX, top + 16, { width: right - splitX - 14, align: 'right' });
      doc
        .fontSize(22)
        .text(`N° ${numeroComprobante}`, splitX, top + 32, { width: right - splitX - 14, align: 'right' });
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#cbd5e1')
        .text(`Fecha: ${formatDateLabel(nota.fecha)}`, splitX, top + 62, {
          width: right - splitX - 14,
          align: 'right',
        });

      // ----- Caja de cliente (todo el ancho) -----
      const clienteY = top + headerH + 18;
      const clienteH = 72;
      doc.save();
      doc.roundedRect(left, clienteY, contentW, clienteH, 6).fillAndStroke('#f9fafb', '#e5e7eb');
      doc.restore();
      doc.fillColor('#6b7280').font('Helvetica-Bold').fontSize(8).text('CLIENTE', left + 14, clienteY + 10);
      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(13)
        .text(nota.cliente?.nombre || '-', left + 14, clienteY + 22, { width: contentW - 28 });
      const clienteInfo = [
        nota.cliente?.numeroDocumento ? `${nota.cliente.tipoDocumento} ${nota.cliente.numeroDocumento}` : null,
        nota.cliente?.direccion,
        [nota.cliente?.codigoPostal, nota.cliente?.localidad, nota.cliente?.provincia].filter(Boolean).join(' '),
        nota.cliente?.telefono ? `Tel ${nota.cliente.telefono}` : null,
      ]
        .filter(Boolean)
        .join('   ·   ');
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#374151')
        .text(clienteInfo, left + 14, clienteY + 44, { width: contentW - 28 });

      // ----- Detalle del pedido -----
      doc.x = left;
      doc.y = clienteY + clienteH + 18;
      drawSectionTitle(doc, 'Detalle del pedido');
      drawSimpleTable(
        doc,
        [
          { label: 'Cant.', x: 40, width: 32, align: 'center' },
          { label: 'Descripción', x: 72, width: 170 },
          { label: 'Identificación', x: 242, width: 93 },
          { label: 'P. unit.', x: 335, width: 68, align: 'right' },
          { label: 'Descuento', x: 403, width: 68, align: 'right' },
          { label: 'Subtotal', x: 471, width: 84, align: 'right' },
        ],
        (nota.items ?? []).map((item) => {
          const identificacion = item.tipoItem === 'queso' && item.plu ? `PLU ${item.plu}` : '-';
          const descuento = toNumber(item.descuento);
          return [
            String(item.cantidad),
            truncateText(item.descripcion, 30),
            identificacion,
            pesos(item.precioUnitario),
            descuento > 0 ? `- ${pesos(descuento)}` : '-',
            pesos(item.subtotal),
          ];
        })
      );

      // ----- Total (chip oscuro a la derecha) -----
      doc.moveDown(0.6);
      const totalY = doc.y;
      doc.save();
      doc.roundedRect(right - 230, totalY, 230, 32, 5).fill('#111827');
      doc.restore();
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(14)
        .text(`TOTAL   ${pesos(nota.total)}`, right - 230, totalY + 9, { width: 216, align: 'right' });
      doc.y = totalY + 44;

      if (nota.observaciones) {
        doc
          .fillColor('#6b7280')
          .font('Helvetica')
          .fontSize(9)
          .text(`Observaciones: ${nota.observaciones}`, left, doc.y, { width: contentW });
      }

      // ----- Pie (manual, una sola hoja) -----
      doc
        .fillColor('#9ca3af')
        .font('Helvetica')
        .fontSize(8)
        .text('Documento no válido como factura · Comprobante interno de venta', left, doc.page.height - 38, {
          width: contentW,
          align: 'center',
        });

      doc.end();
      const buffer = await bufferPromise;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="nota_pedido_${nota.serie}-${nota.numero}.pdf"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async exportReciboPdf(req: AuthRequest, res: Response) {
    try {
      const recibo = await AppDataSource.getRepository(Recibo).findOne({
        where: { id: Number(req.params.id) },
        relations: ['cliente', 'aplicaciones', 'aplicaciones.notaPedido', 'pagos'],
      });

      if (!recibo) {
        return res.status(404).json({ error: 'Recibo no encontrado' });
      }

      const empresa = await AppDataSource.getRepository(Empresa).findOne({
        where: {},
        order: { id: 'ASC' },
      });

      const numeroComprobante = `${recibo.serie}-${recibo.numero}`;
      const pesos = (n: number | string | null | undefined) =>
        `$ ${toNumber(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const medioNombre = (m: string) => (m === 'transferencia' ? 'Transferencia' : 'Efectivo');
      const pagos = recibo.pagos ?? [];
      const mediosTexto =
        pagos.length > 0
          ? pagos.map((p) => `${medioNombre(p.medio)} ${pesos(p.monto)}`).join(' + ')
          : medioNombre(recibo.medioPago);

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const bufferPromise = buildPdfBuffer(doc);

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const contentW = right - left;
      const top = doc.page.margins.top;

      // ----- Encabezado -----
      const headerH = 86;
      const splitX = left + contentW * 0.58;
      doc.save();
      doc.roundedRect(left, top, contentW, headerH, 6).fill('#111827');
      doc.restore();

      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(empresa?.razonSocial || 'Mi empresa', left + 16, top + 13, { width: splitX - left - 24 });
      const emisorInfo = [
        [empresa?.cuit ? `CUIT ${empresa.cuit}` : null, empresa?.condicionIva].filter(Boolean).join(' · '),
        empresa?.direccion,
        [empresa?.codigoPostal, empresa?.localidad, empresa?.provincia].filter(Boolean).join(' '),
        empresa?.telefono ? `Tel ${empresa.telefono}` : null,
      ]
        .filter(Boolean)
        .join('\n');
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#cbd5e1')
        .text(emisorInfo, left + 16, top + 38, { width: splitX - left - 24, lineGap: 1.5 });

      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('RECIBO', splitX, top + 16, { width: right - splitX - 14, align: 'right' });
      doc
        .fontSize(22)
        .text(`N° ${numeroComprobante}`, splitX, top + 32, { width: right - splitX - 14, align: 'right' });
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#cbd5e1')
        .text(`Fecha: ${formatDateLabel(recibo.fecha)}`, splitX, top + 62, {
          width: right - splitX - 14,
          align: 'right',
        });

      // ----- Caja de cliente -----
      const clienteY = top + headerH + 18;
      const clienteH = 60;
      doc.save();
      doc.roundedRect(left, clienteY, contentW, clienteH, 6).fillAndStroke('#f9fafb', '#e5e7eb');
      doc.restore();
      doc.fillColor('#6b7280').font('Helvetica-Bold').fontSize(8).text('RECIBÍ DE', left + 14, clienteY + 10);
      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(13)
        .text(recibo.cliente?.nombre || '-', left + 14, clienteY + 22, { width: contentW - 28 });
      const clienteInfo = [
        recibo.cliente?.numeroDocumento ? `${recibo.cliente.tipoDocumento} ${recibo.cliente.numeroDocumento}` : null,
        recibo.cliente?.localidad,
      ]
        .filter(Boolean)
        .join('   ·   ');
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#374151')
        .text(clienteInfo, left + 14, clienteY + 40, { width: contentW - 28 });

      // ----- Frase + medio de pago -----
      doc.x = left;
      doc.y = clienteY + clienteH + 16;
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#111827')
        .text(`Recibí la suma de ${pesos(recibo.montoTotal)} en concepto de pago, mediante ${mediosTexto}.`, left, doc.y, {
          width: contentW,
        });

      // ----- Detalle: notas pagadas -----
      // Saldo que quedó pendiente en cada nota tras este recibo. Se usa el snapshot
      // guardado al crear el recibo; para recibos viejos (sin snapshot) se cae al
      // saldo actual de la nota.
      const aplicaciones = recibo.aplicaciones ?? [];
      const saldoDe = (ap: (typeof aplicaciones)[number]) =>
        toNumber(ap.saldoPosterior ?? ap.notaPedido?.saldoPendiente ?? 0);
      const saldoAdeudadoTotal = aplicaciones.reduce((s, ap) => s + saldoDe(ap), 0);
      const haySaldo = saldoAdeudadoTotal > 0.001;

      doc.y += 6;
      drawSectionTitle(doc, 'Comprobantes cancelados');
      drawSimpleTable(
        doc,
        [
          { label: 'Nota de pedido', x: 40, width: 230 },
          { label: 'Monto aplicado', x: 270, width: 145, align: 'right' },
          { label: 'Saldo pendiente', x: 415, width: 140, align: 'right' },
        ],
        aplicaciones.map((ap) => [
          `Nota ${ap.numeroNota ?? ''}`,
          pesos(ap.monto),
          pesos(saldoDe(ap)),
        ])
      );

      // ----- Total -----
      doc.moveDown(0.6);
      const totalY = doc.y;
      doc.save();
      doc.roundedRect(right - 230, totalY, 230, 32, 5).fill('#111827');
      doc.restore();
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(14)
        .text(`TOTAL   ${pesos(recibo.montoTotal)}`, right - 230, totalY + 9, { width: 216, align: 'right' });
      doc.y = totalY + 44;

      // Saldo adeudado (solo si el/los pagos fueron parciales)
      if (haySaldo) {
        const saldoY = doc.y;
        doc.save();
        doc.roundedRect(right - 230, saldoY, 230, 26, 5).fillAndStroke('#fef2f2', '#fecaca');
        doc.restore();
        doc
          .fillColor('#b91c1c')
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(`SALDO ADEUDADO   ${pesos(saldoAdeudadoTotal)}`, right - 230, saldoY + 8, {
            width: 216,
            align: 'right',
          });
        doc.y = saldoY + 38;
      }

      if (recibo.observaciones) {
        doc
          .fillColor('#6b7280')
          .font('Helvetica')
          .fontSize(9)
          .text(`Observaciones: ${recibo.observaciones}`, left, doc.y, { width: contentW });
      }

      doc
        .fillColor('#9ca3af')
        .font('Helvetica')
        .fontSize(8)
        .text('Documento no válido como factura · Comprobante interno de cobro', left, doc.page.height - 38, {
          width: contentW,
          align: 'center',
        });

      doc.end();
      const buffer = await bufferPromise;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="recibo_${recibo.serie}-${recibo.numero}.pdf"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async exportNotaCreditoPdf(req: AuthRequest, res: Response) {
    try {
      const nc = await AppDataSource.getRepository(NotaCredito).findOne({
        where: { id: Number(req.params.id) },
        relations: ['cliente', 'notaPedido', 'items'],
      });

      if (!nc) {
        return res.status(404).json({ error: 'Nota de crédito no encontrada' });
      }

      const empresa = await AppDataSource.getRepository(Empresa).findOne({
        where: {},
        order: { id: 'ASC' },
      });

      const numeroComprobante = `${nc.serie}-${nc.numero}`;
      const notaRef = nc.notaPedido ? `${nc.notaPedido.serie}-${nc.notaPedido.numero}` : '-';
      const pesos = (n: number | string | null | undefined) =>
        `$ ${toNumber(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const bufferPromise = buildPdfBuffer(doc);

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const contentW = right - left;
      const top = doc.page.margins.top;

      // ----- Encabezado -----
      const headerH = 92;
      const splitX = left + contentW * 0.56;
      doc.save();
      doc.roundedRect(left, top, contentW, headerH, 6).fill('#111827');
      doc.restore();

      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(empresa?.razonSocial || 'Mi empresa', left + 16, top + 13, { width: splitX - left - 24 });
      const emisorInfo = [
        [empresa?.cuit ? `CUIT ${empresa.cuit}` : null, empresa?.condicionIva].filter(Boolean).join(' · '),
        empresa?.direccion,
        [empresa?.codigoPostal, empresa?.localidad, empresa?.provincia].filter(Boolean).join(' '),
        empresa?.telefono ? `Tel ${empresa.telefono}` : null,
      ]
        .filter(Boolean)
        .join('\n');
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#cbd5e1')
        .text(emisorInfo, left + 16, top + 38, { width: splitX - left - 24, lineGap: 1.5 });

      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('NOTA DE CRÉDITO', splitX, top + 14, { width: right - splitX - 14, align: 'right' });
      doc
        .fontSize(21)
        .text(`N° ${numeroComprobante}`, splitX, top + 30, { width: right - splitX - 14, align: 'right' });
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#cbd5e1')
        .text(`s/ Nota de Pedido ${notaRef}`, splitX, top + 58, { width: right - splitX - 14, align: 'right' })
        .text(`Fecha: ${formatDateLabel(nc.fecha)}`, splitX, top + 72, { width: right - splitX - 14, align: 'right' });

      // ----- Caja de cliente -----
      const clienteY = top + headerH + 18;
      const clienteH = 60;
      doc.save();
      doc.roundedRect(left, clienteY, contentW, clienteH, 6).fillAndStroke('#f9fafb', '#e5e7eb');
      doc.restore();
      doc.fillColor('#6b7280').font('Helvetica-Bold').fontSize(8).text('CLIENTE', left + 14, clienteY + 10);
      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(13)
        .text(nc.cliente?.nombre || '-', left + 14, clienteY + 22, { width: contentW - 28 });
      const clienteInfo = [
        nc.cliente?.numeroDocumento ? `${nc.cliente.tipoDocumento} ${nc.cliente.numeroDocumento}` : null,
        nc.cliente?.localidad,
      ]
        .filter(Boolean)
        .join('   ·   ');
      doc.font('Helvetica').fontSize(9).fillColor('#374151').text(clienteInfo, left + 14, clienteY + 40, { width: contentW - 28 });

      // ----- Detalle: ítems devueltos -----
      doc.x = left;
      doc.y = clienteY + clienteH + 18;
      drawSectionTitle(doc, 'Ítems devueltos');
      drawSimpleTable(
        doc,
        [
          { label: 'Cant.', x: 40, width: 40, align: 'center' },
          { label: 'Descripción', x: 80, width: 250 },
          { label: 'Identificación', x: 330, width: 80 },
          { label: 'P. unit.', x: 410, width: 70, align: 'right' },
          { label: 'Subtotal', x: 480, width: 75, align: 'right' },
        ],
        (nc.items ?? []).map((item) => [
          String(item.cantidad),
          truncateText(item.descripcion, 40),
          item.tipoItem === 'queso' && item.plu ? `PLU ${item.plu}` : '-',
          pesos(item.precioUnitario),
          pesos(item.subtotal),
        ])
      );

      // ----- Total -----
      doc.moveDown(0.6);
      const totalY = doc.y;
      doc.save();
      doc.roundedRect(right - 230, totalY, 230, 32, 5).fill('#111827');
      doc.restore();
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(14)
        .text(`TOTAL   ${pesos(nc.montoTotal)}`, right - 230, totalY + 9, { width: 216, align: 'right' });
      doc.y = totalY + 44;

      if (nc.motivo) {
        doc.fillColor('#6b7280').font('Helvetica').fontSize(9).text(`Motivo: ${nc.motivo}`, left, doc.y, { width: contentW });
      }

      doc
        .fillColor('#9ca3af')
        .font('Helvetica')
        .fontSize(8)
        .text('Documento no válido como factura · Comprobante interno de devolución', left, doc.page.height - 38, {
          width: contentW,
          align: 'center',
        });

      doc.end();
      const buffer = await bufferPromise;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="nota_credito_${nc.serie}-${nc.numero}.pdf"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async exportReporteFacturacionPdf(req: AuthRequest, res: Response) {
    try {
      const desde = typeof req.query.desde === 'string' ? req.query.desde : undefined;
      const hasta = typeof req.query.hasta === 'string' ? req.query.hasta : undefined;
      const data = await computeReporte(desde, hasta);

      const pesos = (n: number | string | null | undefined) =>
        `$ ${toNumber(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const periodoLabel =
        data.periodo.desde && data.periodo.hasta ? `${data.periodo.desde} a ${data.periodo.hasta}` : 'Histórico';

      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      const bufferPromise = buildPdfBuffer(doc);

      drawReportHeader(doc, 'Reporte de ventas', `Las Tres Estrellas | Período: ${periodoLabel}`);
      drawSummaryCards(doc, [
        { label: 'Facturado', value: pesos(data.resumen.totalFacturado) },
        { label: 'Cobrado', value: pesos(data.resumen.totalCobrado) },
        { label: 'Notas de crédito', value: pesos(data.resumen.totalCreditado) },
        { label: 'Saldo pendiente (hoy)', value: pesos(data.resumen.saldoPendienteTotal) },
      ]);

      drawSectionTitle(doc, `Ventas por producto (${periodoLabel})`);
      drawSimpleTable(
        doc,
        [
          { label: 'Producto / Ítem', x: 40, width: 320 },
          { label: 'Cantidad', x: 360, width: 90, align: 'right' },
          { label: 'Monto', x: 450, width: 105, align: 'right' },
        ],
        data.ventasPorProducto.map((v) => [truncateText(v.descripcion, 48), String(v.cantidad), pesos(v.monto)])
      );

      drawSectionTitle(doc, 'Cuenta corriente (saldo actual por cliente)');
      drawSimpleTable(
        doc,
        [
          { label: 'Cliente', x: 40, width: 235 },
          { label: 'Facturado', x: 275, width: 95, align: 'right' },
          { label: 'Cobrado', x: 370, width: 90, align: 'right' },
          { label: 'Saldo', x: 460, width: 95, align: 'right' },
        ],
        data.cuentaCorriente.map((c) => [
          truncateText(c.cliente, 34),
          pesos(c.facturado),
          pesos(c.cobrado),
          pesos(c.saldo),
        ])
      );

      drawPdfFooter(doc);
      doc.end();
      const buffer = await bufferPromise;
      const fileSuffix = data.periodo.desde && data.periodo.hasta ? `${data.periodo.desde}_${data.periodo.hasta}` : 'historico';

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="reporte_ventas_${fileSuffix}.pdf"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ----------------------------- Indumentaria -----------------------------

}

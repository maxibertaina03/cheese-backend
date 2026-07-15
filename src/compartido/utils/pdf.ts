// src/compartido/utils/pdf.ts
//
// Shared kernel: helpers de dibujo para los PDF generados con PDFKit
// (encabezado, tarjetas de resumen, tablas, pie de página). Extraídos de
// reportes.controller.ts para que cualquier reporte los reutilice.
import { formatDateLabel } from './fechas';

export type PdfColumn = {
  label: string;
  x: number;
  width: number;
  align?: 'left' | 'right' | 'center';
};

// Acumula el stream del documento y resuelve con el Buffer final.
export const buildPdfBuffer = (doc: PDFKit.PDFDocument) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

export const textOrDash = (value: string | null | undefined) => value?.trim() || '-';

export const truncateText = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}.` : value;

export const drawSectionTitle = (doc: PDFKit.PDFDocument, title: string) => {
  doc.moveDown(0.8);
  // Posicionar siempre en el margen izquierdo: si el cursor quedó corrido a la derecha
  // (p. ej. tras dibujar tarjetas), un ancho casi nulo hace que el texto se envuelva mal
  // y PDFKit termine generando páginas en blanco.
  doc.x = doc.page.margins.left;
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(13).text(title, doc.page.margins.left, doc.y);
  doc.moveDown(0.3);
};

// Agrega una página si lo que sigue no entra en el espacio restante.
export const ensurePdfSpace = (doc: PDFKit.PDFDocument, height: number, onNewPage?: () => void) => {
  if (doc.y + height <= doc.page.height - doc.page.margins.bottom) {
    return;
  }

  doc.addPage();
  onNewPage?.();
};

export const drawReportHeader = (
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle: string,
  generatedAt = new Date()
) => {
  const { left, right, top } = doc.page.margins;
  const width = doc.page.width - left - right;

  doc.save();
  doc.rect(left, top, width, 46).fill('#111827');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text(title, left + 16, top + 11);
  doc
    .fillColor('#d1d5db')
    .font('Helvetica')
    .fontSize(9)
    .text(subtitle, left + 16, top + 31)
    .text(`Generado: ${formatDateLabel(generatedAt)}`, left + width - 190, top + 18, {
      width: 170,
      align: 'right',
    });
  doc.restore();
  doc.y = top + 62;
};

export const drawSummaryCards = (
  doc: PDFKit.PDFDocument,
  cards: Array<{ label: string; value: string }>
) => {
  const { left, right } = doc.page.margins;
  const gap = 8;
  const width = doc.page.width - left - right;
  const cardWidth = (width - gap * (cards.length - 1)) / cards.length;
  const y = doc.y;

  cards.forEach((card, index) => {
    const x = left + index * (cardWidth + gap);
    doc.save();
    doc.roundedRect(x, y, cardWidth, 38, 4).fill('#f3f4f6');
    doc
      .fillColor('#6b7280')
      .font('Helvetica-Bold')
      .fontSize(7)
      .text(card.label.toUpperCase(), x + 8, y + 7, { width: cardWidth - 16 });
    doc
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(card.value, x + 8, y + 19, { width: cardWidth - 16 });
    doc.restore();
  });

  // Reposicionar el cursor al margen izquierdo (las tarjetas lo dejan corrido a la derecha,
  // lo que puede provocar texto mal envuelto y páginas en blanco en lo que sigue).
  doc.x = left;
  doc.y = y + 50;
};

export const drawPdfTableHeader = (doc: PDFKit.PDFDocument, columns: PdfColumn[]) => {
  const y = doc.y;
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.save();
  doc.rect(left, y, width, 18).fill('#1f2937');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5);
  columns.forEach((column) => {
    doc.text(column.label, column.x, y + 5, {
      width: column.width,
      align: column.align ?? 'left',
      height: 10,
    });
  });
  doc.restore();
  doc.y = y + 22;
};

// Tabla simple con encabezado repetido al saltar de página y filas cebradas.
export const drawSimpleTable = (doc: PDFKit.PDFDocument, columns: PdfColumn[], rows: string[][]) => {
  drawPdfTableHeader(doc, columns);

  if (!rows.length) {
    doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text('Sin datos para mostrar.');
    doc.fillColor('#000000');
    return;
  }

  rows.forEach((row, index) => {
    ensurePdfSpace(doc, 20, () => drawPdfTableHeader(doc, columns));
    const rowY = doc.y;

    if (index % 2 === 0) {
      doc
        .save()
        .rect(doc.page.margins.left, rowY - 3, doc.page.width - doc.page.margins.left - doc.page.margins.right, 18)
        .fill('#f9fafb')
        .restore();
    }

    doc.fillColor('#111827').font('Helvetica').fontSize(8);
    columns.forEach((column, colIndex) => {
      doc.text(row[colIndex] ?? '-', column.x, rowY + 2, {
        width: column.width,
        height: 12,
        align: column.align ?? 'left',
      });
    });
    doc.y = rowY + 20;
  });
};

// Pie de página con paginación. Requiere el documento creado con bufferPages: true.
export const drawPdfFooter = (doc: PDFKit.PDFDocument) => {
  const range = doc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const y = doc.page.height - 24;
    doc
      .fillColor('#6b7280')
      .font('Helvetica')
      .fontSize(7)
      .text('Las Tres Estrellas - Sistema de stock', doc.page.margins.left, y, {
        width: 260,
      })
      .text(`Pagina ${i + 1} de ${range.count}`, doc.page.width - doc.page.margins.right - 90, y, {
        width: 90,
        align: 'right',
      });
  }
};

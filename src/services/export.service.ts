// src/services/export.service.ts
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Response } from 'express';

export class ExportService {
  
  // Exportar a Excel
  static async exportToExcel(data: any[], filename: string, res: Response) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte');

    // Configurar encabezados
    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      worksheet.columns = headers.map(header => ({
        header: header.toUpperCase(),
        key: header,
        width: 20
      }));

      // Estilo de encabezados
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0066CC' }
      };

      // Agregar datos
      data.forEach(item => worksheet.addRow(item));

      // Auto-ajustar columnas
      worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell?.({ includeEmpty: true }, cell => {
          const length = cell.value ? cell.value.toString().length : 0;
          maxLength = Math.max(maxLength, length);
        });
        column.width = Math.min(maxLength + 2, 50);
      });
    }

    // Enviar archivo
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  // Exportar inventario a Excel
  static async exportInventarioExcel(res: Response) {
    const unidadRepo = AppDataSource.getRepository(Unidad);
    
    const unidades = await unidadRepo.find({
      where: { activa: true },
      relations: ['producto', 'producto.tipoQueso', 'motivo'],
      order: { createdAt: 'DESC' }
    });

    const data = unidades.map(u => ({
      ID: u.id,
      Producto: u.producto.nombre,
      PLU: u.producto.plu,
      Tipo: u.producto.tipoQueso.nombre,
      'Peso Inicial (g)': u.pesoInicial,
      'Peso Actual (g)': u.pesoActual,
      'Cortado (g)': Number(u.pesoInicial) - Number(u.pesoActual),
      Motivo: u.motivo?.nombre || 'N/A',
      Observaciones: u.observacionesIngreso || '',
      'Fecha Ingreso': new Date(u.createdAt).toLocaleDateString('es-AR')
    }));

    await this.exportToExcel(data, 'Inventario', res);
  }

  // Exportar historial a Excel
  static async exportHistorialExcel(fechaInicio: Date, fechaFin: Date, res: Response) {
    const unidadRepo = AppDataSource.getRepository(Unidad);
    
    const unidades = await unidadRepo.find({
      where: {
        createdAt: Between(fechaInicio, fechaFin)
      },
      relations: ['producto', 'producto.tipoQueso', 'particiones', 'motivo'],
      order: { createdAt: 'DESC' },
      withDeleted: true
    });

    const data = unidades.map(u => ({
      ID: u.id,
      Producto: u.producto.nombre,
      PLU: u.producto.plu,
      Tipo: u.producto.tipoQueso.nombre,
      'Peso Inicial (g)': u.pesoInicial,
      'Peso Actual (g)': u.pesoActual,
      Estado: u.activa ? 'Activa' : 'Agotada',
      'Cortes Realizados': u.particiones?.length || 0,
      Motivo: u.motivo?.nombre || 'N/A',
      'Fecha Ingreso': new Date(u.createdAt).toLocaleDateString('es-AR')
    }));

    await this.exportToExcel(
      data, 
      `Historial_${fechaInicio.toISOString().split('T')[0]}_${fechaFin.toISOString().split('T')[0]}`,
      res
    );
  }

  // Exportar a PDF
  static async exportInventarioPDF(res: Response) {
    const unidadRepo = AppDataSource.getRepository(Unidad);
    
    const unidades = await unidadRepo.find({
      where: { activa: true },
      relations: ['producto', 'producto.tipoQueso'],
      order: { createdAt: 'DESC' }
    });

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="inventario.pdf"');
    doc.pipe(res);

    // Encabezado
    doc
      .fontSize(20)
      .text('Inventario de Quesos', { align: 'center' })
      .moveDown();

    doc
      .fontSize(12)
      .text(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, { align: 'right' })
      .moveDown();

    // Tabla
    const tableTop = 150;
    let y = tableTop;

    // Encabezados
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('ID', 50, y);
    doc.text('Producto', 100, y);
    doc.text('Tipo', 250, y);
    doc.text('Peso Inicial', 320, y);
    doc.text('Peso Actual', 400, y);
    doc.text('Cortado', 480, y);

    y += 20;
    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 10;

    // Datos
    doc.font('Helvetica');
    unidades.forEach(u => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc.text(u.id.toString(), 50, y);
      doc.text(u.producto.nombre, 100, y, { width: 140 });
      doc.text(u.producto.tipoQueso.nombre, 250, y);
      doc.text(`${u.pesoInicial}g`, 320, y);
      doc.text(`${u.pesoActual}g`, 400, y);
      doc.text(`${Number(u.pesoInicial) - Number(u.pesoActual)}g`, 480, y);

      y += 20;
    });

    // Totales
    const totales = unidades.reduce(
      (acc, u) => ({
        pesoTotal: acc.pesoTotal + Number(u.pesoActual),
        cantidad: acc.cantidad + 1
      }),
      { pesoTotal: 0, cantidad: 0 }
    );

    doc.moveDown(2);
    doc.font('Helvetica-Bold');
    doc.text(`Total Unidades: ${totales.cantidad}`, 50, y + 20);
    doc.text(`Peso Total: ${(totales.pesoTotal / 1000).toFixed(2)} kg`, 50, y + 40);

    doc.end();
  }
}

// Controlador
import { AuthRequest } from '../middlewares/auth';
import { AppDataSource } from '../config/database';
import { Unidad } from '../entities/Unidad';
import { Between } from 'typeorm';

export class ExportController {
  
  static async exportInventarioExcel(req: AuthRequest, res: Response) {
    try {
      await ExportService.exportInventarioExcel(res);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async exportHistorialExcel(req: AuthRequest, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;
      
      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ 
          error: 'Se requieren fechaInicio y fechaFin' 
        });
      }

      await ExportService.exportHistorialExcel(
        new Date(fechaInicio as string),
        new Date(fechaFin as string),
        res
      );
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async exportInventarioPDF(req: AuthRequest, res: Response) {
    try {
      await ExportService.exportInventarioPDF(res);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

// Rutas (agregar a app.ts)
import { Router } from 'express';
import { auth } from '../middlewares/auth';

const exportRouter = Router();

exportRouter.get('/inventario/excel', auth, ExportController.exportInventarioExcel);
exportRouter.get('/inventario/pdf', auth, ExportController.exportInventarioPDF);
exportRouter.get('/historial/excel', auth, ExportController.exportHistorialExcel);

export default exportRouter;







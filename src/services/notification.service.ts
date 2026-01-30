// src/services/notification.service.ts
import { AppDataSource } from '../config/database';
import { Unidad } from '../entities/Unidad';
import { Producto } from '../entities/Producto';
import nodemailer from 'nodemailer';

interface Alerta {
  tipo: 'stock_bajo' | 'vencimiento' | 'merma_alta' | 'inactividad';
  prioridad: 'baja' | 'media' | 'alta';
  mensaje: string;
  detalles?: any;
  timestamp: Date;
}

export class NotificationService {
  private static transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Verificar stock bajo
  static async verificarStockBajo(): Promise<Alerta[]> {
    const unidadRepo = AppDataSource.getRepository(Unidad);
    const alertas: Alerta[] = [];

    // Agrupar por producto
    const productos = await unidadRepo
      .createQueryBuilder('unidad')
      .leftJoin('unidad.producto', 'producto')
      .select('producto.id', 'productoId')
      .addSelect('producto.nombre', 'nombre')
      .addSelect('COUNT(unidad.id)', 'cantidad')
      .addSelect('SUM(unidad.pesoActual)', 'pesoTotal')
      .where('unidad.activa = true')
      .groupBy('producto.id')
      .addGroupBy('producto.nombre')
      .getRawMany();

    productos.forEach(p => {
      const cantidad = parseInt(p.cantidad);
      const pesoTotal = parseFloat(p.pesoTotal);

      // Alerta de cantidad baja
      if (cantidad <= 2) {
        alertas.push({
          tipo: 'stock_bajo',
          prioridad: cantidad === 0 ? 'alta' : cantidad === 1 ? 'media' : 'baja',
          mensaje: `Stock bajo de ${p.nombre}`,
          detalles: {
            producto: p.nombre,
            cantidad,
            pesoTotal: (pesoTotal / 1000).toFixed(2) + ' kg'
          },
          timestamp: new Date()
        });
      }

      // Alerta de peso bajo
      if (pesoTotal < 1000) { // Menos de 1kg
        alertas.push({
          tipo: 'stock_bajo',
          prioridad: 'media',
          mensaje: `Peso bajo de ${p.nombre}`,
          detalles: {
            producto: p.nombre,
            pesoTotal: (pesoTotal / 1000).toFixed(2) + ' kg'
          },
          timestamp: new Date()
        });
      }
    });

    return alertas;
  }

  // Verificar unidades sin movimiento
  static async verificarInactividad(dias: number = 7): Promise<Alerta[]> {
    const unidadRepo = AppDataSource.getRepository(Unidad);
    const alertas: Alerta[] = [];

    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - dias);

    const unidadesSinMovimiento = await unidadRepo
      .createQueryBuilder('unidad')
      .leftJoin('unidad.producto', 'producto')
      .leftJoin('unidad.particiones', 'particiones')
      .select('unidad.id', 'id')
      .addSelect('producto.nombre', 'producto')
      .addSelect('unidad.pesoActual', 'peso')
      .addSelect('unidad.createdAt', 'creado')
      .addSelect('MAX(particiones.createdAt)', 'ultimoCorte')
      .where('unidad.activa = true')
      .andWhere('unidad.createdAt < :fecha', { fecha: fechaLimite })
      .groupBy('unidad.id')
      .addGroupBy('producto.nombre')
      .addGroupBy('unidad.pesoActual')
      .addGroupBy('unidad.createdAt')
      .having('MAX(particiones.createdAt) IS NULL OR MAX(particiones.createdAt) < :fecha', { 
        fecha: fechaLimite 
      })
      .getRawMany();

    unidadesSinMovimiento.forEach(u => {
      const diasSinMovimiento = Math.floor(
        (Date.now() - new Date(u.creado).getTime()) / (1000 * 60 * 60 * 24)
      );

      alertas.push({
        tipo: 'inactividad',
        prioridad: diasSinMovimiento > 14 ? 'alta' : 'media',
        mensaje: `Unidad sin movimiento: ${u.producto}`,
        detalles: {
          unidadId: u.id,
          producto: u.producto,
          peso: `${u.peso}g`,
          diasSinMovimiento
        },
        timestamp: new Date()
      });
    });

    return alertas;
  }

  // Obtener todas las alertas
  static async obtenerTodasLasAlertas(): Promise<Alerta[]> {
    const [stockBajo, inactividad] = await Promise.all([
      this.verificarStockBajo(),
      this.verificarInactividad()
    ]);

    return [...stockBajo, ...inactividad].sort((a, b) => {
      const prioridadOrden = { alta: 0, media: 1, baja: 2 };
      return prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad];
    });
  }

  // Enviar email de alerta
  static async enviarEmailAlerta(destinatario: string, alertas: Alerta[]) {
    if (alertas.length === 0) return;

    const html = `
      <h2>Alertas del Sistema de Stock</h2>
      <p>Se detectaron ${alertas.length} alerta(s):</p>
      <ul>
        ${alertas.map(a => `
          <li>
            <strong style="color: ${
              a.prioridad === 'alta' ? 'red' : 
              a.prioridad === 'media' ? 'orange' : 'gray'
            }">
              ${a.prioridad.toUpperCase()}
            </strong>: ${a.mensaje}
            ${a.detalles ? `<br><small>${JSON.stringify(a.detalles)}</small>` : ''}
          </li>
        `).join('')}
      </ul>
      <p><em>Fecha: ${new Date().toLocaleString('es-AR')}</em></p>
    `;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: destinatario,
      subject: `⚠️ Alertas de Stock (${alertas.length})`,
      html
    });
  }

  // Job programado (ejecutar diariamente)
  static async verificarYNotificar(emailAdmin: string) {
    try {
      const alertas = await this.obtenerTodasLasAlertas();
      
      if (alertas.length > 0) {
        await this.enviarEmailAlerta(emailAdmin, alertas);
        console.log(`✅ Email enviado: ${alertas.length} alertas`);
      } else {
        console.log('✓ No hay alertas');
      }

      return alertas;
    } catch (error) {
      console.error('Error en verificación de alertas:', error);
      throw error;
    }
  }
}

// Controlador
import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';

export class AlertasController {
  
  static async getAlertas(req: AuthRequest, res: Response) {
    try {
      const alertas = await NotificationService.obtenerTodasLasAlertas();
      res.json(alertas);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async enviarReporte(req: AuthRequest, res: Response) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Email requerido' });
      }

      const alertas = await NotificationService.verificarYNotificar(email);
      
      res.json({ 
        message: 'Reporte enviado',
        alertas: alertas.length
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

// Configurar cron job (agregar en server.ts)
import cron from 'node-cron';

// Ejecutar todos los días a las 8 AM
cron.schedule('0 8 * * *', async () => {
  console.log('🔔 Ejecutando verificación de alertas...');
  
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    await NotificationService.verificarYNotificar(adminEmail);
  }
});
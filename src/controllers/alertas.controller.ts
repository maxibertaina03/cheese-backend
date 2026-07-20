// src/controllers/alertas.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { AppDataSource } from '../config/database';
import { Indumentaria } from '../modulos/indumentaria/entities/Indumentaria';
import { Unidad } from '../modulos/inventario-quesos/entities/Unidad';

interface Alerta {
  tipo: 'stock_bajo' | 'inactividad';
  prioridad: 'baja' | 'media' | 'alta';
  mensaje: string;
  detalles?: any;
  timestamp: Date;
}

export class AlertasController {
  // GET /api/alertas
  // Los errores inesperados se derivan al errorHandler global vía asyncHandler.
  static async getAlertas(_req: AuthRequest, res: Response) {
      const alertas: Alerta[] = [];
      const unidadRepo = AppDataSource.getRepository(Unidad);

      // Stock bajo
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

        if (pesoTotal < 1000) {
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

      // Stock bajo de indumentaria
      const indumentariaRepo = AppDataSource.getRepository(Indumentaria);
      const indumentariaBaja = await indumentariaRepo
        .createQueryBuilder('prenda')
        .where('prenda.activo = :activo', { activo: true })
        .andWhere('prenda.stockMinimo > 0')
        .andWhere('prenda.cantidadDisponible <= prenda.stockMinimo')
        .getMany();

      indumentariaBaja.forEach((prenda) => {
        const disponible = Number(prenda.cantidadDisponible);
        const detalle = [prenda.nombre, prenda.talle ? `Talle ${prenda.talle}` : null]
          .filter(Boolean)
          .join(' - ');

        alertas.push({
          tipo: 'stock_bajo',
          prioridad: disponible === 0 ? 'alta' : 'media',
          mensaje: `Stock bajo de indumentaria: ${detalle}`,
          detalles: {
            prenda: prenda.nombre,
            talle: prenda.talle,
            categoria: prenda.categoria,
            disponible,
            stockMinimo: Number(prenda.stockMinimo),
            ubicacion: prenda.ubicacion,
          },
          timestamp: new Date(),
        });
      });

      // Inactividad
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() - 7);

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

      // Ordenar por prioridad
      const prioridadOrden = { alta: 0, media: 1, baja: 2 };
      alertas.sort((a, b) => prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad]);

      res.json(alertas);
  }
}
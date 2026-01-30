// src/controllers/reportes.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { AppDataSource } from '../config/database';
import { Unidad } from '../entities/Unidad';
import { Particion } from '../entities/Particion';
import { Between } from 'typeorm';

export class ReportesController {
  
  // GET /api/reportes/dashboard
  static async getDashboard(req: AuthRequest, res: Response) {
    try {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      const hace7dias = new Date();
      hace7dias.setDate(hace7dias.getDate() - 7);
      hace7dias.setHours(0, 0, 0, 0);
      
      const hace30dias = new Date();
      hace30dias.setDate(hace30dias.getDate() - 30);
      hace30dias.setHours(0, 0, 0, 0);

      // Inventario actual
      const unidadRepo = AppDataSource.getRepository(Unidad);
      const inventarioActual = await unidadRepo
        .createQueryBuilder('unidad')
        .leftJoin('unidad.producto', 'producto')
        .leftJoin('producto.tipoQueso', 'tipo')
        .select('COUNT(unidad.id)', 'cantidad')
        .addSelect('SUM(unidad.pesoActual)', 'pesoTotal')
        .addSelect('tipo.nombre', 'tipoQueso')
        .where('unidad.activa = true')
        .groupBy('tipo.nombre')
        .getRawMany();

      // Ventas por período
      const particionRepo = AppDataSource.getRepository(Particion);
      
      const ventasHoy = await particionRepo
        .createQueryBuilder('particion')
        .leftJoin('particion.unidad', 'unidad')
        .leftJoin('unidad.producto', 'producto')
        .select('DATE(particion.createdAt)', 'fecha')
        .addSelect('producto.nombre', 'producto')
        .addSelect('SUM(particion.peso)', 'totalPeso')
        .addSelect('COUNT(particion.id)', 'cantidadCortes')
        .where('particion.createdAt >= :hoy', { hoy })
        .groupBy('DATE(particion.createdAt)')
        .addGroupBy('producto.nombre')
        .getRawMany();

      const ventasSemana = await particionRepo
        .createQueryBuilder('particion')
        .leftJoin('particion.unidad', 'unidad')
        .leftJoin('unidad.producto', 'producto')
        .select('DATE(particion.createdAt)', 'fecha')
        .addSelect('producto.nombre', 'producto')
        .addSelect('SUM(particion.peso)', 'totalPeso')
        .addSelect('COUNT(particion.id)', 'cantidadCortes')
        .where('particion.createdAt >= :hace7dias', { hace7dias })
        .groupBy('DATE(particion.createdAt)')
        .addGroupBy('producto.nombre')
        .getRawMany();

      const ventasMes = await particionRepo
        .createQueryBuilder('particion')
        .leftJoin('particion.unidad', 'unidad')
        .leftJoin('unidad.producto', 'producto')
        .select('DATE(particion.createdAt)', 'fecha')
        .addSelect('producto.nombre', 'producto')
        .addSelect('SUM(particion.peso)', 'totalPeso')
        .addSelect('COUNT(particion.id)', 'cantidadCortes')
        .where('particion.createdAt >= :hace30dias', { hace30dias })
        .groupBy('DATE(particion.createdAt)')
        .addGroupBy('producto.nombre')
        .getRawMany();

      // Top productos
      const topProductos = await particionRepo
        .createQueryBuilder('particion')
        .leftJoin('particion.unidad', 'unidad')
        .leftJoin('unidad.producto', 'producto')
        .select('producto.id', 'productoId')
        .addSelect('producto.nombre', 'nombre')
        .addSelect('SUM(particion.peso)', 'totalVendido')
        .addSelect('COUNT(particion.id)', 'cantidadCortes')
        .addSelect('AVG(particion.peso)', 'promedioCorte')
        .groupBy('producto.id')
        .addGroupBy('producto.nombre')
        .orderBy('totalVendido', 'DESC')
        .limit(10)
        .getRawMany();

      // Inventario valorizado
      const inventarioValorizado = await unidadRepo
        .createQueryBuilder('unidad')
        .leftJoin('unidad.producto', 'producto')
        .select('producto.nombre', 'producto')
        .addSelect('COUNT(unidad.id)', 'cantidad')
        .addSelect('SUM(unidad.pesoActual)', 'pesoTotal')
        .addSelect('producto.precioPorKilo', 'precioKilo')
        .addSelect('SUM(unidad.pesoActual * producto.precioPorKilo / 1000)', 'valorTotal')
        .where('unidad.activa = true')
        .andWhere('producto.precioPorKilo IS NOT NULL')
        .groupBy('producto.id')
        .addGroupBy('producto.nombre')
        .addGroupBy('producto.precioPorKilo')
        .getRawMany();

      res.json({
        inventarioActual,
        ventas: {
          hoy: ventasHoy,
          semana: ventasSemana,
          mes: ventasMes
        },
        topProductos,
        inventarioValorizado
      });
    } catch (error: any) {
      console.error('Error en getDashboard:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/reportes/ventas
  static async getVentas(req: AuthRequest, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;
      
      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ 
          error: 'Se requieren fechaInicio y fechaFin' 
        });
      }

      const particionRepo = AppDataSource.getRepository(Particion);
      
      const ventas = await particionRepo
        .createQueryBuilder('particion')
        .leftJoin('particion.unidad', 'unidad')
        .leftJoin('unidad.producto', 'producto')
        .leftJoin('particion.motivo', 'motivo')
        .select('DATE(particion.createdAt)', 'fecha')
        .addSelect('producto.nombre', 'producto')
        .addSelect('SUM(particion.peso)', 'totalPeso')
        .addSelect('COUNT(particion.id)', 'cantidadCortes')
        .addSelect('motivo.nombre', 'motivo')
        .where('particion.createdAt BETWEEN :inicio AND :fin', { 
          inicio: new Date(fechaInicio as string), 
          fin: new Date(fechaFin as string) 
        })
        .groupBy('DATE(particion.createdAt)')
        .addGroupBy('producto.nombre')
        .addGroupBy('motivo.nombre')
        .getRawMany();

      res.json(ventas);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/reportes/top-productos
  static async getTopProductos(req: AuthRequest, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      const particionRepo = AppDataSource.getRepository(Particion);
      
      const topProductos = await particionRepo
        .createQueryBuilder('particion')
        .leftJoin('particion.unidad', 'unidad')
        .leftJoin('unidad.producto', 'producto')
        .select('producto.id', 'productoId')
        .addSelect('producto.nombre', 'nombre')
        .addSelect('SUM(particion.peso)', 'totalVendido')
        .addSelect('COUNT(particion.id)', 'cantidadCortes')
        .addSelect('AVG(particion.peso)', 'promedioCorte')
        .groupBy('producto.id')
        .addGroupBy('producto.nombre')
        .orderBy('totalVendido', 'DESC')
        .limit(limit)
        .getRawMany();

      res.json(topProductos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/reportes/inventario-valorizado
  static async getInventarioValorizado(req: AuthRequest, res: Response) {
    try {
      const unidadRepo = AppDataSource.getRepository(Unidad);
      
      const inventario = await unidadRepo
        .createQueryBuilder('unidad')
        .leftJoin('unidad.producto', 'producto')
        .select('producto.nombre', 'producto')
        .addSelect('COUNT(unidad.id)', 'cantidad')
        .addSelect('SUM(unidad.pesoActual)', 'pesoTotal')
        .addSelect('producto.precioPorKilo', 'precioKilo')
        .addSelect('SUM(unidad.pesoActual * producto.precioPorKilo / 1000)', 'valorTotal')
        .where('unidad.activa = true')
        .andWhere('producto.precioPorKilo IS NOT NULL')
        .groupBy('producto.id')
        .addGroupBy('producto.nombre')
        .addGroupBy('producto.precioPorKilo')
        .getRawMany();

      res.json(inventario);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
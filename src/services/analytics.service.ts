// src/services/analytics.service.ts
import { AppDataSource } from '../config/database';
import { Unidad } from '../entities/Unidad';
import { Particion } from '../entities/Particion';
import { Producto } from '../entities/Producto';
import { Between } from 'typeorm';

export class AnalyticsService {
  
  // Ventas por período
  static async getVentasPorPeriodo(fechaInicio: Date, fechaFin: Date) {
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
        inicio: fechaInicio, 
        fin: fechaFin 
      })
      .groupBy('DATE(particion.createdAt)')
      .addGroupBy('producto.nombre')
      .addGroupBy('motivo.nombre')
      .getRawMany();

    return ventas;
  }

  // Productos más vendidos
  static async getTopProductos(limit: number = 10) {
    const particionRepo = AppDataSource.getRepository(Particion);
    
    return await particionRepo
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
  }

  // Inventario valorizado
  static async getInventarioValorizado() {
    const unidadRepo = AppDataSource.getRepository(Unidad);
    
    return await unidadRepo
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
  }

  // Rotación de inventario
  static async getRotacionInventario(dias: number = 30) {
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - dias);

    const unidadRepo = AppDataSource.getRepository(Unidad);
    
    const ingresos = await unidadRepo
      .createQueryBuilder('unidad')
      .leftJoin('unidad.producto', 'producto')
      .select('producto.id', 'productoId')
      .addSelect('producto.nombre', 'nombre')
      .addSelect('COUNT(unidad.id)', 'cantidadIngresada')
      .addSelect('SUM(unidad.pesoInicial)', 'pesoIngresado')
      .where('unidad.createdAt >= :fecha', { fecha: fechaInicio })
      .groupBy('producto.id')
      .addGroupBy('producto.nombre')
      .getRawMany();

    const particionRepo = AppDataSource.getRepository(Particion);
    
    const egresos = await particionRepo
      .createQueryBuilder('particion')
      .leftJoin('particion.unidad', 'unidad')
      .leftJoin('unidad.producto', 'producto')
      .select('producto.id', 'productoId')
      .addSelect('SUM(particion.peso)', 'pesoEgresado')
      .where('particion.createdAt >= :fecha', { fecha: fechaInicio })
      .groupBy('producto.id')
      .getRawMany();

    return { ingresos, egresos, periodo: dias };
  }

  // Mermas y pérdidas
  static async getMermas(fechaInicio: Date, fechaFin: Date) {
    const particionRepo = AppDataSource.getRepository(Particion);
    
    return await particionRepo
      .createQueryBuilder('particion')
      .leftJoin('particion.unidad', 'unidad')
      .leftJoin('unidad.producto', 'producto')
      .leftJoin('particion.motivo', 'motivo')
      .select('producto.nombre', 'producto')
      .addSelect('motivo.nombre', 'motivo')
      .addSelect('SUM(particion.peso)', 'totalPeso')
      .addSelect('COUNT(particion.id)', 'cantidad')
      .where('particion.createdAt BETWEEN :inicio AND :fin', { 
        inicio: fechaInicio, 
        fin: fechaFin 
      })
      .andWhere("motivo.nombre IN ('Merma', 'Consumo Interno', 'Cortesía')")
      .groupBy('producto.nombre')
      .addGroupBy('motivo.nombre')
      .getRawMany();
  }

  // Dashboard resumen
  static async getDashboard() {
    const hoy = new Date();
    const hace7dias = new Date();
    hace7dias.setDate(hace7dias.getDate() - 7);
    const hace30dias = new Date();
    hace30dias.setDate(hace30dias.getDate() - 30);

    const [
      inventarioActual,
      ventasHoy,
      ventasSemana,
      ventasMes,
      topProductos,
      inventarioValorizado
    ] = await Promise.all([
      this.getInventarioActual(),
      this.getVentasPorPeriodo(hoy, hoy),
      this.getVentasPorPeriodo(hace7dias, hoy),
      this.getVentasPorPeriodo(hace30dias, hoy),
      this.getTopProductos(5),
      this.getInventarioValorizado()
    ]);

    return {
      inventarioActual,
      ventas: {
        hoy: ventasHoy,
        semana: ventasSemana,
        mes: ventasMes
      },
      topProductos,
      inventarioValorizado
    };
  }

  private static async getInventarioActual() {
    const unidadRepo = AppDataSource.getRepository(Unidad);
    
    return await unidadRepo
      .createQueryBuilder('unidad')
      .leftJoin('unidad.producto', 'producto')
      .leftJoin('producto.tipoQueso', 'tipo')
      .select('COUNT(unidad.id)', 'cantidad')
      .addSelect('SUM(unidad.pesoActual)', 'pesoTotal')
      .addSelect('tipo.nombre', 'tipoQueso')
      .where('unidad.activa = true')
      .groupBy('tipo.nombre')
      .getRawMany();
  }
}

// Controlador para reportes
import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';

export class ReportesController {
  
  static async getDashboard(req: AuthRequest, res: Response) {
    try {
      const dashboard = await AnalyticsService.getDashboard();
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getVentas(req: AuthRequest, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;
      
      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ 
          error: 'Se requieren fechaInicio y fechaFin' 
        });
      }

      const ventas = await AnalyticsService.getVentasPorPeriodo(
        new Date(fechaInicio as string),
        new Date(fechaFin as string)
      );

      res.json(ventas);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getTopProductos(req: AuthRequest, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const topProductos = await AnalyticsService.getTopProductos(limit);
      res.json(topProductos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getInventarioValorizado(req: AuthRequest, res: Response) {
    try {
      const inventario = await AnalyticsService.getInventarioValorizado();
      res.json(inventario);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getRotacion(req: AuthRequest, res: Response) {
    try {
      const dias = parseInt(req.query.dias as string) || 30;
      const rotacion = await AnalyticsService.getRotacionInventario(dias);
      res.json(rotacion);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getMermas(req: AuthRequest, res: Response) {
    try {
      const { fechaInicio, fechaFin } = req.query;
      
      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ 
          error: 'Se requieren fechaInicio y fechaFin' 
        });
      }

      const mermas = await AnalyticsService.getMermas(
        new Date(fechaInicio as string),
        new Date(fechaFin as string)
      );

      res.json(mermas);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
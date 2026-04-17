// ============================================
// ARCHIVO: src/controllers/stock-elemento.controller.ts (NUEVO)
// ============================================
import { Response } from 'express';
import { Between, MoreThan, LessThanOrEqual } from 'typeorm';
import { AppDataSource } from '../config/database';
import { StockElemento } from '../entities/StockElemento';
import { TipoElemento } from '../entities/TipoElemento';
import { MovimientoStock } from '../entities/MovimientoStock';
import { Motivo } from '../entities/Motivo';
import { Usuario } from '../entities/Usuario';
import { AuthRequest } from '../middlewares/auth';

export class StockElementoController {

  // GET /api/stock-elementos - Listar todos los elementos con stock
  static async getAll(req: AuthRequest, res: Response) {
    try {
      const stockRepo = AppDataSource.getRepository(StockElemento);
      
      const stocks = await stockRepo.find({
        where: { activo: true },
        relations: ['tipo', 'creadoPor'],
        order: { createdAt: 'DESC' },
      });

      res.json(stocks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/stock-elementos - Crear nuevo tipo de elemento en stock
  static async create(req: AuthRequest, res: Response) {
    try {
      const { tipoId, stockInicial, stockMinimo, ubicacion, observaciones } = req.body;

      if (!tipoId || stockInicial === undefined) {
        return res.status(400).json({ 
          error: 'El tipo y stock inicial son obligatorios' 
        });
      }

      const stockRepo = AppDataSource.getRepository(StockElemento);
      const tipoRepo = AppDataSource.getRepository(TipoElemento);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      // Verificar que el tipo existe
      const tipo = await tipoRepo.findOneBy({ id: tipoId });
      if (!tipo) {
        return res.status(404).json({ error: 'Tipo de elemento no encontrado' });
      }

      // Verificar si ya existe stock para este tipo en esta ubicación
      const existente = await stockRepo.findOne({
        where: { 
          tipo: { id: tipoId },
          ubicacion: ubicacion || null,
          activo: true 
        },
      });

      if (existente) {
        return res.status(400).json({ 
          error: 'Ya existe stock para este tipo en esta ubicación. Use ingreso de stock.' 
        });
      }

      // Obtener usuario que crea
      let usuarioCreador = null;
      if (req.user?.id) {
        usuarioCreador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      const stockElemento = stockRepo.create({
        tipo,
        stockActual: stockInicial,
        stockMinimo: stockMinimo || 0,
        stockTotalIngresado: stockInicial,
        ubicacion: ubicacion || null,
        observaciones,
        creadoPor: usuarioCreador,
      });

      await stockRepo.save(stockElemento);

      // Registrar movimiento inicial
      const movimientoRepo = AppDataSource.getRepository(MovimientoStock);
      const movimiento = movimientoRepo.create({
        stockElemento,
        tipo: 'INGRESO',
        cantidad: stockInicial,
        stockAnterior: 0,
        stockNuevo: stockInicial,
        fechaMovimiento: new Date(),
        usuario: usuarioCreador,
        observaciones: 'Stock inicial',
      });
      await movimientoRepo.save(movimiento);

      const stockCompleto = await stockRepo.findOne({
        where: { id: stockElemento.id },
        relations: ['tipo', 'creadoPor'],
      });

      res.status(201).json(stockCompleto);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/stock-elementos/:id/ingreso - Ingresar más stock
  static async ingresarStock(req: AuthRequest, res: Response) {
    try {
      const { cantidad, observaciones, documentoReferencia } = req.body;
      const stockRepo = AppDataSource.getRepository(StockElemento);
      const movimientoRepo = AppDataSource.getRepository(MovimientoStock);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      if (!cantidad || cantidad <= 0) {
        return res.status(400).json({ 
          error: 'La cantidad debe ser mayor a 0' 
        });
      }

      const stockElemento = await stockRepo.findOne({
        where: { id: Number(req.params.id) },
        relations: ['tipo'],
      });

      if (!stockElemento) {
        return res.status(404).json({ error: 'Stock no encontrado' });
      }

      if (!stockElemento.activo) {
        return res.status(400).json({ 
          error: 'Este elemento de stock está inactivo' 
        });
      }

      // Obtener usuario
      let usuario = null;
      if (req.user?.id) {
        usuario = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      // Actualizar stock
      const stockAnterior = stockElemento.stockActual;
      const stockNuevo = stockAnterior + Number(cantidad);

      stockElemento.stockActual = stockNuevo;
      stockElemento.stockTotalIngresado += Number(cantidad);
      await stockRepo.save(stockElemento);

      // Registrar movimiento
      const movimiento = movimientoRepo.create({
        stockElemento,
        tipo: 'INGRESO',
        cantidad: Number(cantidad),
        stockAnterior,
        stockNuevo,
        fechaMovimiento: new Date(),
        documentoReferencia: documentoReferencia || null,
        observaciones: observaciones || null,
        usuario,
      });
      await movimientoRepo.save(movimiento);

      res.json({
        message: 'Stock ingresado exitosamente',
        stockAnterior,
        stockNuevo,
        movimiento,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/stock-elementos/:id/egreso - Egresar stock
  static async egresarStock(req: AuthRequest, res: Response) {
    try {
      const { cantidad, motivoId, observaciones, documentoReferencia } = req.body;
      const stockRepo = AppDataSource.getRepository(StockElemento);
      const movimientoRepo = AppDataSource.getRepository(MovimientoStock);
      const motivoRepo = AppDataSource.getRepository(Motivo);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      if (!cantidad || cantidad <= 0) {
        return res.status(400).json({ 
          error: 'La cantidad debe ser mayor a 0' 
        });
      }

      if (!motivoId) {
        return res.status(400).json({ 
          error: 'El motivo del egreso es obligatorio' 
        });
      }

      const stockElemento = await stockRepo.findOne({
        where: { id: Number(req.params.id) },
        relations: ['tipo'],
      });

      if (!stockElemento) {
        return res.status(404).json({ error: 'Stock no encontrado' });
      }

      // Verificar stock suficiente
      if (stockElemento.stockActual < cantidad) {
        return res.status(400).json({ 
          error: `Stock insuficiente. Disponible: ${stockElemento.stockActual}` 
        });
      }

      // Verificar motivo
      const motivo = await motivoRepo.findOneBy({ id: motivoId });
      if (!motivo) {
        return res.status(404).json({ error: 'Motivo no encontrado' });
      }

      // Obtener usuario
      let usuario = null;
      if (req.user?.id) {
        usuario = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      // Actualizar stock
      const stockAnterior = stockElemento.stockActual;
      const stockNuevo = stockAnterior - Number(cantidad);

      stockElemento.stockActual = stockNuevo;
      await stockRepo.save(stockElemento);

      // Registrar movimiento
      const movimiento = movimientoRepo.create({
        stockElemento,
        tipo: 'EGRESO',
        cantidad: Number(cantidad),
        stockAnterior,
        stockNuevo,
        motivo,
        fechaMovimiento: new Date(),
        documentoReferencia: documentoReferencia || null,
        observaciones: observaciones || null,
        usuario,
      });
      await movimientoRepo.save(movimiento);

      // Verificar si está por debajo del stock mínimo
      let alerta = null;
      if (stockElemento.stockMinimo > 0 && stockNuevo < stockElemento.stockMinimo) {
        alerta = {
          tipo: 'STOCK_BAJO',
          mensaje: `Stock por debajo del mínimo (${stockElemento.stockMinimo})`,
          stockActual: stockNuevo,
          stockMinimo: stockElemento.stockMinimo,
        };
      }

      res.json({
        message: 'Stock egresado exitosamente',
        stockAnterior,
        stockNuevo,
        movimiento,
        alerta,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/stock-elementos/:id/movimientos - Obtener historial de movimientos
  static async getMovimientos(req: AuthRequest, res: Response) {
    try {
      const { fechaInicio, fechaFin, tipo } = req.query;
      const movimientoRepo = AppDataSource.getRepository(MovimientoStock);
      
      const where: any = {
        stockElemento: { id: Number(req.params.id) },
      };

      if (tipo && tipo !== 'todos') {
        where.tipo = tipo;
      }

      if (fechaInicio && fechaFin) {
        where.fechaMovimiento = Between(
          new Date(fechaInicio as string),
          new Date(fechaFin as string)
        );
      }

      const movimientos = await movimientoRepo.find({
        where,
        relations: ['motivo', 'usuario'],
        order: { fechaMovimiento: 'DESC', createdAt: 'DESC' },
      });

      res.json(movimientos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/stock-elementos/reporte/bajos - Elementos con stock bajo
  static async getStockBajo(req: AuthRequest, res: Response) {
    try {
      const stockRepo = AppDataSource.getRepository(StockElemento);
      
      const stocksBajos = await stockRepo
        .createQueryBuilder('stock')
        .leftJoinAndSelect('stock.tipo', 'tipo')
        .where('stock.activo = :activo', { activo: true })
        .andWhere('stock.stockMinimo > 0')
        .andWhere('stock.stockActual <= stock.stockMinimo')
        .orderBy('stock.stockActual', 'ASC')
        .getMany();

      res.json({
        total: stocksBajos.length,
        elementos: stocksBajos,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /api/stock-elementos/:id - Actualizar información
  static async update(req: AuthRequest, res: Response) {
    try {
      const { stockMinimo, ubicacion, observaciones } = req.body;
      const stockRepo = AppDataSource.getRepository(StockElemento);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      const stockElemento = await stockRepo.findOneBy({
        id: Number(req.params.id),
      });

      if (!stockElemento) {
        return res.status(404).json({ error: 'Stock no encontrado' });
      }

      // Obtener usuario que modifica
      let usuarioModificador = null;
      if (req.user?.id) {
        usuarioModificador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      if (stockMinimo !== undefined) stockElemento.stockMinimo = stockMinimo;
      if (ubicacion !== undefined) stockElemento.ubicacion = ubicacion;
      if (observaciones !== undefined) stockElemento.observaciones = observaciones;

      await stockRepo.save(stockElemento);

      res.json(stockElemento);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/stock-elementos/:id/ajuste - Ajuste manual de stock
  static async ajusteStock(req: AuthRequest, res: Response) {
    try {
      const { cantidad, motivo, observaciones } = req.body;
      const stockRepo = AppDataSource.getRepository(StockElemento);
      const movimientoRepo = AppDataSource.getRepository(MovimientoStock);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      if (!cantidad || cantidad === 0) {
        return res.status(400).json({ 
          error: 'La cantidad no puede ser 0' 
        });
      }

      if (!motivo) {
        return res.status(400).json({ 
          error: 'El motivo del ajuste es obligatorio' 
        });
      }

      const stockElemento = await stockRepo.findOne({
        where: { id: Number(req.params.id) },
        relations: ['tipo'],
      });

      if (!stockElemento) {
        return res.status(404).json({ error: 'Stock no encontrado' });
      }

      // Obtener usuario
      let usuario = null;
      if (req.user?.id) {
        usuario = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      // Actualizar stock
      const stockAnterior = stockElemento.stockActual;
      const stockNuevo = stockAnterior + Number(cantidad);

      if (stockNuevo < 0) {
        return res.status(400).json({ 
          error: 'El ajuste dejaría el stock en negativo' 
        });
      }

      stockElemento.stockActual = stockNuevo;
      // Si es positivo, sumar al total ingresado
      if (cantidad > 0) {
        stockElemento.stockTotalIngresado += Number(cantidad);
      }
      await stockRepo.save(stockElemento);

      // Registrar movimiento de ajuste
      const movimiento = movimientoRepo.create({
        stockElemento,
        tipo: 'AJUSTE',
        cantidad: Math.abs(Number(cantidad)),
        stockAnterior,
        stockNuevo,
        fechaMovimiento: new Date(),
        observaciones: `${motivo}${observaciones ? ' - ' + observaciones : ''}`,
        usuario,
      });
      await movimientoRepo.save(movimiento);

      res.json({
        message: 'Ajuste de stock registrado',
        stockAnterior,
        stockNuevo,
        movimiento,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
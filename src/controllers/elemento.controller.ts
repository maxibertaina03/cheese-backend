// ============================================
// ARCHIVO: src/controllers/elemento.controller.ts (CORREGIDO - COMPLETO)
// ============================================
import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Elemento } from '../entities/Elemento';
import { MovimientoElemento } from '../entities/MovimientoElemento';
import { Motivo } from '../entities/Motivo';
import { Usuario } from '../entities/Usuario';
import { AuthRequest } from '../middlewares/auth';

export class ElementoController {

  // GET /api/elementos - Listar todos los elementos
  static async getAll(req: AuthRequest, res: Response) {
    try {
      const elementoRepo = AppDataSource.getRepository(Elemento);

      const elementos = await elementoRepo.find({
        relations: ['creadoPor', 'modificadoPor'],
        order: { createdAt: 'DESC' },
        withDeleted: false,
      });

      res.json(elementos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/elementos/:id - Obtener un elemento específico
  static async getOne(req: AuthRequest, res: Response) {
    try {
      const elementoRepo = AppDataSource.getRepository(Elemento);

      const elemento = await elementoRepo.findOne({
        where: { id: Number(req.params.id) },
        relations: ['creadoPor', 'modificadoPor'],
      });

      if (!elemento) {
        return res.status(404).json({ error: 'Elemento no encontrado' });
      }

      res.json(elemento);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/elementos - Crear nuevo elemento
  static async create(req: AuthRequest, res: Response) {
    try {
      const { nombre, cantidadTotal, descripcion } = req.body;

      if (!nombre || cantidadTotal === undefined) {
        return res.status(400).json({ 
          error: 'El nombre y la cantidad inicial son obligatorios' 
        });
      }

      const elementoRepo = AppDataSource.getRepository(Elemento);
      const movimientoRepo = AppDataSource.getRepository(MovimientoElemento);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      // Verificar si ya existe un elemento con ese nombre
      const existente = await elementoRepo.findOne({
        where: { nombre },
        withDeleted: true,
      });

      if (existente) {
        return res.status(400).json({ 
          error: 'Ya existe un elemento con este nombre' 
        });
      }

      // Obtener usuario que crea
      let usuarioCreador = null;
      if (req.user?.id) {
        usuarioCreador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      const cantidadInicial = Number(cantidadTotal);

      const elemento = elementoRepo.create({
        nombre,
        descripcion: descripcion || null,
        cantidadDisponible: cantidadInicial,
        cantidadTotal: cantidadInicial,
        activo: true,
        creadoPor: usuarioCreador,
      });

      await elementoRepo.save(elemento);

      // Registrar movimiento inicial de ingreso
      const movimiento = movimientoRepo.create({
        elemento,
        tipo: 'ingreso',
        cantidad: cantidadInicial,
        stockAnterior: 0,
        stockNuevo: cantidadInicial,
        observaciones: 'Stock inicial',
        creadoPor: usuarioCreador,
      });
      await movimientoRepo.save(movimiento);

      const elementoCompleto = await elementoRepo.findOne({
        where: { id: elemento.id },
        relations: ['creadoPor'],
      });

      res.status(201).json(elementoCompleto);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /api/elementos/:id - Actualizar elemento (solo nombre/descripción)
  static async update(req: AuthRequest, res: Response) {
    try {
      const { nombre, descripcion } = req.body;
      const elementoRepo = AppDataSource.getRepository(Elemento);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      const elemento = await elementoRepo.findOne({
        where: { id: Number(req.params.id) },
      });

      if (!elemento) {
        return res.status(404).json({ error: 'Elemento no encontrado' });
      }

      // Obtener usuario que modifica
      let usuarioModificador = null;
      if (req.user?.id) {
        usuarioModificador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      if (nombre !== undefined) elemento.nombre = nombre;
      if (descripcion !== undefined) elemento.descripcion = descripcion;
      elemento.modificadoPor = usuarioModificador;

      await elementoRepo.save(elemento);

      const elementoCompleto = await elementoRepo.findOne({
        where: { id: elemento.id },
        relations: ['creadoPor', 'modificadoPor'],
      });

      res.json(elementoCompleto);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/elementos/:id/ingreso - Registrar ingreso de stock
  static async registrarIngreso(req: AuthRequest, res: Response) {
    try {
      const { cantidad, observaciones } = req.body;
      const elementoRepo = AppDataSource.getRepository(Elemento);
      const movimientoRepo = AppDataSource.getRepository(MovimientoElemento);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      if (!cantidad || cantidad <= 0) {
        return res.status(400).json({ 
          error: 'La cantidad debe ser mayor a 0' 
        });
      }

      const elemento = await elementoRepo.findOne({
        where: { id: Number(req.params.id) },
      });

      if (!elemento) {
        return res.status(404).json({ error: 'Elemento no encontrado' });
      }

      // Obtener usuario
      let usuario = null;
      if (req.user?.id) {
        usuario = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      const cantidadNum = Number(cantidad);
      const stockAnterior = elemento.cantidadDisponible;
      const stockNuevo = stockAnterior + cantidadNum;

      // Actualizar elemento
      elemento.cantidadDisponible = stockNuevo;
      elemento.cantidadTotal += cantidadNum;
      elemento.activo = true; // Reactivar si estaba inactivo
      await elementoRepo.save(elemento);

      // Registrar movimiento
      const movimiento = movimientoRepo.create({
        elemento,
        tipo: 'ingreso',
        cantidad: cantidadNum,
        stockAnterior,
        stockNuevo,
        observaciones: observaciones || null,
        creadoPor: usuario,
      });
      await movimientoRepo.save(movimiento);

      res.json({
        message: 'Ingreso registrado exitosamente',
        stockAnterior,
        stockNuevo,
        movimiento,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/elementos/:id/egreso - Registrar egreso de stock
  static async registrarEgreso(req: AuthRequest, res: Response) {
    try {
      const { cantidad, motivoId, observaciones } = req.body;
      const elementoRepo = AppDataSource.getRepository(Elemento);
      const movimientoRepo = AppDataSource.getRepository(MovimientoElemento);
      const motivoRepo = AppDataSource.getRepository(Motivo);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      if (!cantidad || cantidad <= 0) {
        return res.status(400).json({ 
          error: 'La cantidad debe ser mayor a 0' 
        });
      }

      const elemento = await elementoRepo.findOne({
        where: { id: Number(req.params.id) },
      });

      if (!elemento) {
        return res.status(404).json({ error: 'Elemento no encontrado' });
      }

      if (elemento.cantidadDisponible < cantidad) {
        return res.status(400).json({ 
          error: `Stock insuficiente. Disponible: ${elemento.cantidadDisponible}` 
        });
      }

      // Verificar motivo si se proporciona
      let motivo = null;
      if (motivoId) {
        motivo = await motivoRepo.findOneBy({ id: motivoId });
        if (!motivo) {
          return res.status(404).json({ error: 'Motivo no encontrado' });
        }
      }

      // Obtener usuario
      let usuario = null;
      if (req.user?.id) {
        usuario = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      const cantidadNum = Number(cantidad);
      const stockAnterior = elemento.cantidadDisponible;
      const stockNuevo = stockAnterior - cantidadNum;

      // Actualizar elemento
      elemento.cantidadDisponible = stockNuevo;
      if (stockNuevo === 0) {
        elemento.activo = false;
      }
      await elementoRepo.save(elemento);

      // Registrar movimiento
      const movimiento = movimientoRepo.create({
        elemento,
        tipo: 'egreso',
        cantidad: cantidadNum,
        stockAnterior,
        stockNuevo,
        motivo,
        observaciones: observaciones || null,
        creadoPor: usuario,
      });
      await movimientoRepo.save(movimiento);

      res.json({
        message: 'Egreso registrado exitosamente',
        stockAnterior,
        stockNuevo,
        movimiento,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/elementos/:id/movimientos - Obtener historial de movimientos
  static async getMovimientos(req: AuthRequest, res: Response) {
    try {
      const movimientoRepo = AppDataSource.getRepository(MovimientoElemento);

      const movimientos = await movimientoRepo.find({
        where: { elemento: { id: Number(req.params.id) } },
        relations: ['motivo', 'creadoPor'],
        order: { createdAt: 'DESC' },
      });

      res.json(movimientos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // DELETE /api/elementos/:id - Soft delete
  static async delete(req: AuthRequest, res: Response) {
    try {
      const elementoRepo = AppDataSource.getRepository(Elemento);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      const elemento = await elementoRepo.findOneBy({
        id: Number(req.params.id),
      });

      if (!elemento) {
        return res.status(404).json({ error: 'Elemento no encontrado' });
      }

      // Obtener usuario que elimina
      let usuarioEliminador = null;
      if (req.user?.id) {
        usuarioEliminador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      elemento.eliminadoPor = usuarioEliminador;
      await elementoRepo.softRemove(elemento);

      res.json({ message: 'Elemento eliminado exitosamente' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
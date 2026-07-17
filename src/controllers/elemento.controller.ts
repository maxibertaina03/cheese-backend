// ============================================
// ARCHIVO: src/controllers/elemento.controller.ts
// ============================================
// Los errores inesperados se derivan al errorHandler global vía asyncHandler
// (ver rutas); acá solo se responden los errores de negocio (400/404).
import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Elemento } from '../entities/Elemento';
import { MovimientoElemento } from '../entities/MovimientoElemento';
import { Motivo } from '../entities/Motivo';
import { AuthRequest } from '../middlewares/auth';
import { getUsuarioActual } from '../compartido/utils/usuarioActual';

type ControllerErrorResult = {
  error: {
    status: number;
    payload: { error: string };
  };
};

type ElementoMovimientoResult =
  | ControllerErrorResult
  | {
      message: string;
      stockAnterior: number;
      stockNuevo: number;
      movimiento: MovimientoElemento;
    };

export class ElementoController {
  // GET /api/elementos - Listar todos los elementos
  static async getAll(_req: AuthRequest, res: Response) {
    const elementos = await AppDataSource.getRepository(Elemento).find({
      relations: ['creadoPor', 'modificadoPor'],
      order: { createdAt: 'DESC' },
      withDeleted: false,
    });

    res.json(elementos);
  }

  // GET /api/elementos/:id - Obtener un elemento específico
  static async getOne(req: AuthRequest, res: Response) {
    const elemento = await AppDataSource.getRepository(Elemento).findOne({
      where: { id: Number(req.params.id) },
      relations: ['creadoPor', 'modificadoPor'],
    });

    if (!elemento) {
      return res.status(404).json({ error: 'Elemento no encontrado' });
    }

    res.json(elemento);
  }

  // POST /api/elementos - Crear nuevo elemento
  static async create(req: AuthRequest, res: Response) {
    const { nombre, cantidadTotal, descripcion, precioUnitario, esVendible } = req.body;

    if (!nombre || cantidadTotal === undefined) {
      return res.status(400).json({ error: 'El nombre y la cantidad inicial son obligatorios' });
    }

    const elementoRepo = AppDataSource.getRepository(Elemento);
    const movimientoRepo = AppDataSource.getRepository(MovimientoElemento);

    // Verificar si ya existe un elemento con ese nombre
    const existente = await elementoRepo.findOne({
      where: { nombre },
      withDeleted: true,
    });

    if (existente) {
      return res.status(400).json({ error: 'Ya existe un elemento con este nombre' });
    }

    const usuarioCreador = await getUsuarioActual(req);
    const cantidadInicial = Number(cantidadTotal);

    const elemento = elementoRepo.create({
      nombre,
      descripcion: descripcion || null,
      cantidadDisponible: cantidadInicial,
      cantidadTotal: cantidadInicial,
      activo: true,
      precioUnitario: precioUnitario ?? 0,
      esVendible: esVendible ?? false,
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
  }

  // PUT /api/elementos/:id - Actualizar elemento (solo nombre/descripción)
  static async update(req: AuthRequest, res: Response) {
    const { nombre, descripcion, precioUnitario, esVendible } = req.body;
    const elementoRepo = AppDataSource.getRepository(Elemento);

    const elemento = await elementoRepo.findOne({ where: { id: Number(req.params.id) } });

    if (!elemento) {
      return res.status(404).json({ error: 'Elemento no encontrado' });
    }

    if (nombre !== undefined) elemento.nombre = nombre;
    if (descripcion !== undefined) elemento.descripcion = descripcion;
    if (precioUnitario !== undefined) elemento.precioUnitario = precioUnitario;
    if (esVendible !== undefined) elemento.esVendible = esVendible;
    elemento.modificadoPor = await getUsuarioActual(req);

    await elementoRepo.save(elemento);

    const elementoCompleto = await elementoRepo.findOne({
      where: { id: elemento.id },
      relations: ['creadoPor', 'modificadoPor'],
    });

    res.json(elementoCompleto);
  }

  // PUT /api/elementos/:id/venta - Actualizar datos de venta (precio + si se vende).
  // Usado por la pestaña Precios de Facturación: solo toca esos campos, por eso lo
  // puede hacer un usuario con permiso de facturación sin acceso al ABM de elementos.
  static async updateVenta(req: AuthRequest, res: Response) {
    const { precioUnitario, esVendible } = req.body as {
      precioUnitario?: number;
      esVendible?: boolean;
    };
    const elementoRepo = AppDataSource.getRepository(Elemento);

    const elemento = await elementoRepo.findOne({ where: { id: Number(req.params.id) } });
    if (!elemento) {
      return res.status(404).json({ error: 'Elemento no encontrado' });
    }

    if (precioUnitario !== undefined) elemento.precioUnitario = precioUnitario;
    if (esVendible !== undefined) elemento.esVendible = esVendible;
    elemento.modificadoPor = await getUsuarioActual(req);

    await elementoRepo.save(elemento);

    const elementoCompleto = await elementoRepo.findOne({
      where: { id: elemento.id },
      relations: ['creadoPor', 'modificadoPor'],
    });

    res.json(elementoCompleto);
  }

  // POST /api/elementos/:id/ingreso - Registrar ingreso de stock
  static async registrarIngreso(req: AuthRequest, res: Response) {
    const { cantidad, observaciones } = req.body;
    const cantidadNum = Number(cantidad);

    if (!cantidadNum || cantidadNum <= 0) {
      return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
    }

    const result: ElementoMovimientoResult = await AppDataSource.transaction(
      async (manager): Promise<ElementoMovimientoResult> => {
        const elementoRepo = manager.getRepository(Elemento);
        const movimientoRepo = manager.getRepository(MovimientoElemento);

        const elemento = await elementoRepo.findOne({
          where: { id: Number(req.params.id) },
          lock: { mode: 'pessimistic_write' },
        });

        if (!elemento) {
          return {
            error: {
              status: 404,
              payload: { error: 'Elemento no encontrado' },
            },
          } satisfies ControllerErrorResult;
        }

        const usuario = await getUsuarioActual(req, manager);

        const stockAnterior = Number(elemento.cantidadDisponible);
        const stockNuevo = stockAnterior + cantidadNum;

        // Actualizar elemento
        elemento.cantidadDisponible = stockNuevo;
        elemento.cantidadTotal = Number(elemento.cantidadTotal) + cantidadNum;
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

        return {
          message: 'Ingreso registrado exitosamente',
          stockAnterior,
          stockNuevo,
          movimiento,
        };
      }
    );

    if ('error' in result) {
      return res.status(result.error.status).json(result.error.payload);
    }

    res.json(result);
  }

  // POST /api/elementos/:id/egreso - Registrar egreso de stock
  static async registrarEgreso(req: AuthRequest, res: Response) {
    const { cantidad, motivoId, observaciones } = req.body;
    const cantidadNum = Number(cantidad);

    if (!cantidadNum || cantidadNum <= 0) {
      return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
    }

    const result: ElementoMovimientoResult = await AppDataSource.transaction(
      async (manager): Promise<ElementoMovimientoResult> => {
        const elementoRepo = manager.getRepository(Elemento);
        const movimientoRepo = manager.getRepository(MovimientoElemento);
        const motivoRepo = manager.getRepository(Motivo);

        const elemento = await elementoRepo.findOne({
          where: { id: Number(req.params.id) },
          lock: { mode: 'pessimistic_write' },
        });

        if (!elemento) {
          return {
            error: {
              status: 404,
              payload: { error: 'Elemento no encontrado' },
            },
          } satisfies ControllerErrorResult;
        }

        const stockAnterior = Number(elemento.cantidadDisponible);

        if (stockAnterior < cantidadNum) {
          return {
            error: {
              status: 400,
              payload: { error: `Stock insuficiente. Disponible: ${stockAnterior}` },
            },
          } satisfies ControllerErrorResult;
        }

        // Verificar motivo si se proporciona
        let motivo = null;
        if (motivoId) {
          motivo = await motivoRepo.findOneBy({ id: motivoId });
          if (!motivo) {
            return {
              error: {
                status: 404,
                payload: { error: 'Motivo no encontrado' },
              },
            } satisfies ControllerErrorResult;
          }
        }

        const usuario = await getUsuarioActual(req, manager);

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

        return {
          message: 'Egreso registrado exitosamente',
          stockAnterior,
          stockNuevo,
          movimiento,
        };
      }
    );

    if ('error' in result) {
      return res.status(result.error.status).json(result.error.payload);
    }

    res.json(result);
  }

  // GET /api/elementos/:id/movimientos - Obtener historial de movimientos
  static async getMovimientos(req: AuthRequest, res: Response) {
    const movimientos = await AppDataSource.getRepository(MovimientoElemento).find({
      where: { elemento: { id: Number(req.params.id) } },
      relations: ['motivo', 'creadoPor'],
      order: { createdAt: 'DESC' },
    });

    res.json(movimientos);
  }

  // DELETE /api/elementos/:id - Soft delete
  static async delete(req: AuthRequest, res: Response) {
    const elementoRepo = AppDataSource.getRepository(Elemento);

    const elemento = await elementoRepo.findOneBy({ id: Number(req.params.id) });

    if (!elemento) {
      return res.status(404).json({ error: 'Elemento no encontrado' });
    }

    elemento.eliminadoPor = await getUsuarioActual(req);
    await elementoRepo.softRemove(elemento);

    res.json({ message: 'Elemento eliminado exitosamente' });
  }
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnidadController = void 0;
const database_1 = require("../config/database");
const Unidad_1 = require("../entities/Unidad");
const Producto_1 = require("../entities/Producto");
const Particion_1 = require("../entities/Particion");
class UnidadController {
    // Crear una unidad (ingreso de mercadería)
    static async create(req, res) {
        try {
            const { productoId, pesoInicial, observacionesIngreso } = req.body;
            if (!productoId || typeof pesoInicial !== 'number' || pesoInicial <= 0) {
                return res.status(400).json({
                    error: 'productoId y pesoInicial (> 0) son obligatorios',
                });
            }
            const productoRepo = database_1.AppDataSource.getRepository(Producto_1.Producto);
            const unidadRepo = database_1.AppDataSource.getRepository(Unidad_1.Unidad);
            const producto = await productoRepo.findOneBy({ id: productoId });
            if (!producto) {
                return res.status(404).json({ error: 'Producto no encontrado' });
            }
            const unidad = unidadRepo.create({
                producto,
                pesoInicial,
                pesoActual: pesoInicial,
                activa: true,
                observacionesIngreso: observacionesIngreso || null, // Agregado
            });
            await unidadRepo.save(unidad);
            res.status(201).json(unidad);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    // Listar unidades activas
    static async getAll(req, res) {
        try {
            const unidadRepo = database_1.AppDataSource.getRepository(Unidad_1.Unidad);
            const unidades = await unidadRepo.find({
                where: { activa: true },
                relations: ['producto', 'producto.tipoQueso', 'particiones'],
                order: { createdAt: 'DESC' },
                select: ['id', 'pesoInicial', 'pesoActual', 'activa', 'createdAt', 'observacionesIngreso'], // Agregado
            });
            res.json(unidades);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    // Actualizar observaciones de una unidad
    static async update(req, res) {
        try {
            const unidadId = Number(req.params.id);
            const { observacionesIngreso } = req.body;
            const unidadRepo = database_1.AppDataSource.getRepository(Unidad_1.Unidad);
            const unidad = await unidadRepo.findOneBy({ id: unidadId });
            if (!unidad) {
                return res.status(404).json({ error: 'Unidad no encontrada' });
            }
            unidad.observacionesIngreso = observacionesIngreso || null;
            await unidadRepo.save(unidad);
            res.json(unidad);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    // Agregar una partición (venta / corte)
    // Agregar una partición (venta / corte)
    static async addParticiones(req, res) {
        try {
            const unidadId = Number(req.params.id);
            const { peso, observacionesCorte } = req.body;
            if (peso === null || peso === undefined || peso < 0) {
                return res.status(400).json({ error: 'El peso debe ser 0 o mayor' });
            }
            const unidadRepo = database_1.AppDataSource.getRepository(Unidad_1.Unidad);
            const particionRepo = database_1.AppDataSource.getRepository(Particion_1.Particion);
            const unidad = await unidadRepo.findOneBy({ id: unidadId });
            if (!unidad || !unidad.activa) {
                return res.status(404).json({ error: 'Unidad no encontrada o inactiva' });
            }
            // ✅ Manejo del egreso total
            let pesoFinal = peso;
            if (pesoFinal === 0) {
                if (Number(unidad.pesoActual) === 0) {
                    return res.status(400).json({ error: 'La unidad ya está agotada' });
                }
                pesoFinal = Number(unidad.pesoActual);
            }
            if (Number(unidad.pesoActual) < pesoFinal) {
                return res.status(400).json({ error: 'Peso insuficiente en la unidad' });
            }
            const particion = particionRepo.create({
                unidad,
                peso: pesoFinal,
                observacionesCorte: observacionesCorte || null,
            });
            unidad.pesoActual = Number(unidad.pesoActual) - pesoFinal;
            if (unidad.pesoActual === 0) {
                unidad.activa = false;
            }
            await particionRepo.save(particion);
            await unidadRepo.save(unidad);
            res.json({ unidad, particion });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
exports.UnidadController = UnidadController;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const Unidad_1 = require("../entities/Unidad");
const unidad_controller_1 = require("../controllers/unidad.controller");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Función para obtener historial completo
const getHistorial = async (req, res) => {
    try {
        const unidadRepo = database_1.AppDataSource.getRepository(Unidad_1.Unidad);
        const unidades = await unidadRepo.find({
            relations: ['producto', 'producto.tipoQueso', 'particiones'],
            order: { createdAt: 'DESC' },
        });
        res.json(unidades);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
// ⚠️ IMPORTANTE: La ruta /historial debe ir ANTES de /:id para evitar conflictos
router.get('/historial', getHistorial);
// Rutas principales
router.post('/', auth_1.auth, (0, auth_1.requireRole)('admin'), unidad_controller_1.UnidadController.create);
router.get('/', unidad_controller_1.UnidadController.getAll);
router.post('/:id/particiones', auth_1.auth, (0, auth_1.requireRole)('admin'), unidad_controller_1.UnidadController.addParticiones);
router.put('/:id', auth_1.auth, (0, auth_1.requireRole)('admin'), unidad_controller_1.UnidadController.update);
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const TipoQueso_1 = require("../entities/TipoQueso");
const router = (0, express_1.Router)();
/* GET todos los tipos */
router.get('/', async (req, res) => {
    try {
        const tipoQuesoRepo = database_1.AppDataSource.getRepository(TipoQueso_1.TipoQueso);
        const tipos = await tipoQuesoRepo.find();
        res.json(tipos);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/* POST crear tipo de queso */
router.post('/', async (req, res) => {
    try {
        const { nombre } = req.body;
        if (!nombre) {
            return res.status(400).json({
                error: 'El campo nombre es obligatorio'
            });
        }
        const repo = database_1.AppDataSource.getRepository(TipoQueso_1.TipoQueso);
        // evitar duplicados
        const existente = await repo.findOne({ where: { nombre } });
        if (existente) {
            return res.status(409).json({
                error: 'Ya existe un tipo de queso con ese nombre'
            });
        }
        const nuevo = repo.create({ nombre });
        await repo.save(nuevo);
        res.status(201).json(nuevo);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear tipo de queso' });
    }
});
exports.default = router;

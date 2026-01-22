"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const TipoQueso_1 = require("../entities/TipoQueso");
const router = (0, express_1.Router)();
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
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const Particion_1 = require("../entities/Particion");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const particionRepo = database_1.AppDataSource.getRepository(Particion_1.Particion);
        const particiones = await particionRepo.find({
            relations: ['unidad'],
        });
        res.json(particiones);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;

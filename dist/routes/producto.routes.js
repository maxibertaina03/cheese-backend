"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const producto_controller_1 = require("../controllers/producto.controller");
const router = (0, express_1.Router)();
router.post('/', producto_controller_1.ProductoController.create);
router.get('/', producto_controller_1.ProductoController.getAll);
router.put('/:id/precio', producto_controller_1.ProductoController.updatePrecio);
exports.default = router;

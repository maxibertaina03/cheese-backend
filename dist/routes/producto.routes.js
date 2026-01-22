"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// producto.routes.ts
const express_1 = require("express");
const producto_controller_1 = require("../controllers/producto.controller");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.post('/', auth_1.auth, (0, auth_1.requireRole)('admin'), producto_controller_1.ProductoController.create);
router.get('/', auth_1.auth, producto_controller_1.ProductoController.getAll);
router.put('/:id/precio', auth_1.auth, (0, auth_1.requireRole)('admin'), producto_controller_1.ProductoController.updatePrecio);
exports.default = router;

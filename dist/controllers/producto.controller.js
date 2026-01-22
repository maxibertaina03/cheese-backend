"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductoController = void 0;
const database_1 = require("../config/database");
const Producto_1 = require("../entities/Producto");
const TipoQueso_1 = require("../entities/TipoQueso");
class ProductoController {
    static async create(req, res) {
        try {
            const { plu, nombre, tipoQuesoId, seVendePorUnidad } = req.body;
            const productoRepo = database_1.AppDataSource.getRepository(Producto_1.Producto);
            const tipoRepo = database_1.AppDataSource.getRepository(TipoQueso_1.TipoQueso);
            const tipoQueso = await tipoRepo.findOneBy({ id: tipoQuesoId });
            if (!tipoQueso) {
                return res.status(404).json({ error: 'Tipo de queso no encontrado' });
            }
            const existe = await productoRepo.findOneBy({ plu });
            if (existe) {
                return res.status(400).json({ error: 'PLU ya registrado' });
            }
            const producto = productoRepo.create({
                plu,
                nombre,
                tipoQueso,
                seVendePorUnidad,
                precioPorKilo: req.body.precioPorKilo ?? null,
            });
            await productoRepo.save(producto);
            res.status(201).json(producto);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    // nuevo endpoint rápido para editar solo precio
    static async updatePrecio(req, res) {
        try {
            const { id } = req.params;
            const { precioPorKilo } = req.body;
            const repo = database_1.AppDataSource.getRepository(Producto_1.Producto);
            const prod = await repo.findOneBy({ id: Number(id) });
            if (!prod)
                return res.status(404).json({ error: 'Producto no encontrado' });
            prod.precioPorKilo = precioPorKilo;
            await repo.save(prod);
            res.json(prod);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
    static async getAll(req, res) {
        try {
            const productoRepo = database_1.AppDataSource.getRepository(Producto_1.Producto);
            const productos = await productoRepo.find({ relations: ['tipoQueso'] });
            res.json(productos);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
exports.ProductoController = ProductoController;

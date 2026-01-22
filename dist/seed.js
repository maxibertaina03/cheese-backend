"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const database_1 = require("./config/database");
const TipoQueso_1 = require("./entities/TipoQueso");
const Producto_1 = require("./entities/Producto");
async function seed() {
    await database_1.AppDataSource.initialize();
    const tipoQuesoRepo = database_1.AppDataSource.getRepository(TipoQueso_1.TipoQueso);
    const productoRepo = database_1.AppDataSource.getRepository(Producto_1.Producto);
    // Crear tipos de queso
    const blando = await tipoQuesoRepo.save({ nombre: 'blando' });
    const semiDuro = await tipoQuesoRepo.save({ nombre: 'semi-duro' });
    const duro = await tipoQuesoRepo.save({ nombre: 'duro' });
    // Crear productos de ejemplo
    await productoRepo.save({
        nombre: 'Cremoso Las Tres',
        plu: '0200020200',
        tipoQueso: semiDuro,
        seVendePorUnidad: false,
    });
    await productoRepo.save({
        nombre: 'Sardo Las Tres',
        plu: '0300030300',
        tipoQueso: duro,
        seVendePorUnidad: false,
    });
}
seed().catch(console.error);

import 'reflect-metadata';
import { AppDataSource } from './config/database';
import { TipoQueso } from './entities/TipoQueso';
import { Producto } from './entities/Producto';

async function seed() {
  await AppDataSource.initialize();

  const tipoQuesoRepo = AppDataSource.getRepository(TipoQueso);
  const productoRepo = AppDataSource.getRepository(Producto);

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
import 'reflect-metadata';
import { AppDataSource } from './config/database';
import { TipoQueso } from './entities/TipoQueso';
import { Producto } from './entities/Producto';

const SPECIAL_PRODUCTS = new Set(['azul', 'camembert', 'brie', 'feta de cabra']);

const normalizeName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const isSpecialProduct = (name: string) => {
  const normalized = normalizeName(name).replace(/^queso\s+/, '');
  return SPECIAL_PRODUCTS.has(normalized);
};

async function seed() {
  await AppDataSource.initialize();

  const tipoQuesoRepo = AppDataSource.getRepository(TipoQueso);
  const productoRepo = AppDataSource.getRepository(Producto);

  const findOrCreateTipo = async (nombre: string) => {
    const existing = await tipoQuesoRepo.findOne({ where: { nombre } });
    if (existing) {
      return existing;
    }

    return tipoQuesoRepo.save({ nombre });
  };

  const findOrCreateProducto = async (data: {
    nombre: string;
    plu: string;
    tipoQueso: TipoQueso;
    seVendePorUnidad: boolean;
  }) => {
    const existing = await productoRepo.findOne({
      where: { plu: data.plu },
      relations: ['tipoQueso'],
    });

    if (existing) {
      return existing;
    }

    return productoRepo.save(data);
  };

  await findOrCreateTipo('blando');
  const semiDuro = await findOrCreateTipo('semi-duro');
  const duro = await findOrCreateTipo('duro');
  const especial = await findOrCreateTipo('especial');

  // Crear productos de ejemplo
  await findOrCreateProducto({
    nombre: 'Cremoso Las Tres',
    plu: '0200020200',
    tipoQueso: semiDuro,
    seVendePorUnidad: false,
  });

  await findOrCreateProducto({
    nombre: 'Sardo Las Tres',
    plu: '0300030300',
    tipoQueso: duro,
    seVendePorUnidad: false,
  });

  const productos = await productoRepo.find({ relations: ['tipoQueso'] });
  const productosEspeciales = productos.filter((producto) => isSpecialProduct(producto.nombre));

  await Promise.all(
    productosEspeciales.map((producto) => {
      if (producto.tipoQueso?.id === especial.id) {
        return producto;
      }

      producto.tipoQueso = especial;
      return productoRepo.save(producto);
    })
  );
}

seed().catch(console.error);

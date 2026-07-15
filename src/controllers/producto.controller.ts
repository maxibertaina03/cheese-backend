// ============================================
// ARCHIVO: src/controllers/producto.controller.ts
// ============================================
// Los errores inesperados se derivan al errorHandler global vía asyncHandler
// (ver rutas); acá solo se responden los errores de negocio (400/404).
import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Producto } from '../entities/Producto';
import { TipoQueso } from '../entities/TipoQueso';
import { AuthRequest } from '../middlewares/auth';
import { getUsuarioActual } from '../compartido/utils/usuarioActual';

export class ProductoController {
  // POST /api/productos - Crear producto
  static async create(req: AuthRequest, res: Response) {
    const { plu, nombre, tipoQuesoId, seVendePorUnidad, precioPorKilo, precioUnitario } = req.body;

    const productoRepo = AppDataSource.getRepository(Producto);
    const tipoRepo = AppDataSource.getRepository(TipoQueso);

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
      precioPorKilo: precioPorKilo ?? null,
      precioUnitario: precioUnitario ?? null,
      creadoPor: await getUsuarioActual(req),
    });

    await productoRepo.save(producto);

    const productoCompleto = await productoRepo.findOne({
      where: { id: producto.id },
      relations: ['tipoQueso', 'creadoPor'],
    });

    res.status(201).json(productoCompleto);
  }

  // GET /api/productos - Listar todos los productos
  static async getAll(_req: AuthRequest, res: Response) {
    const productos = await AppDataSource.getRepository(Producto).find({
      relations: ['tipoQueso', 'creadoPor', 'modificadoPor'],
      order: { nombre: 'ASC' },
    });
    res.json(productos);
  }

  // GET /api/productos/:id - Obtener un producto específico
  static async getOne(req: AuthRequest, res: Response) {
    const producto = await AppDataSource.getRepository(Producto).findOne({
      where: { id: Number(req.params.id) },
      relations: ['tipoQueso', 'unidades', 'creadoPor', 'modificadoPor'],
    });

    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(producto);
  }

  // PUT /api/productos/:id - Actualizar producto completo
  static async update(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { nombre, plu, seVendePorUnidad, precioPorKilo, precioUnitario, tipoQuesoId } = req.body;

    const productoRepo = AppDataSource.getRepository(Producto);
    const tipoRepo = AppDataSource.getRepository(TipoQueso);

    const producto = await productoRepo.findOne({
      where: { id: Number(id) },
      relations: ['tipoQueso'],
    });

    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Verificar PLU duplicado si se cambia
    if (plu && plu !== producto.plu) {
      const existe = await productoRepo.findOneBy({ plu });
      if (existe) {
        return res.status(400).json({ error: 'PLU ya registrado' });
      }
      producto.plu = plu;
    }

    // Actualizar tipo de queso si se proporciona
    if (tipoQuesoId) {
      const tipoQueso = await tipoRepo.findOneBy({ id: tipoQuesoId });
      if (!tipoQueso) {
        return res.status(404).json({ error: 'Tipo de queso no encontrado' });
      }
      producto.tipoQueso = tipoQueso;
    }

    if (nombre) producto.nombre = nombre;
    if (seVendePorUnidad !== undefined) producto.seVendePorUnidad = seVendePorUnidad;
    if (precioPorKilo !== undefined) producto.precioPorKilo = precioPorKilo;
    if (precioUnitario !== undefined) producto.precioUnitario = precioUnitario;
    producto.modificadoPor = await getUsuarioActual(req);

    await productoRepo.save(producto);

    const productoCompleto = await productoRepo.findOne({
      where: { id: Number(id) },
      relations: ['tipoQueso', 'creadoPor', 'modificadoPor'],
    });

    res.json(productoCompleto);
  }

  // PUT /api/productos/:id/precio - Actualizar solo precio
  static async updatePrecio(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { precioPorKilo } = req.body;

    const productoRepo = AppDataSource.getRepository(Producto);

    const producto = await productoRepo.findOneBy({ id: Number(id) });
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    producto.precioPorKilo = precioPorKilo;
    producto.modificadoPor = await getUsuarioActual(req);

    await productoRepo.save(producto);

    const productoCompleto = await productoRepo.findOne({
      where: { id: Number(id) },
      relations: ['tipoQueso', 'modificadoPor'],
    });

    res.json(productoCompleto);
  }

  // DELETE /api/productos/:id - Soft delete
  static async delete(req: AuthRequest, res: Response) {
    const productoRepo = AppDataSource.getRepository(Producto);

    const producto = await productoRepo.findOne({
      where: { id: Number(req.params.id) },
      relations: ['unidades'],
    });

    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // No se puede eliminar si todavía tiene unidades activas en inventario
    const unidadesActivas = producto.unidades?.filter((u) => u.activa && !u.deletedAt).length || 0;
    if (unidadesActivas > 0) {
      return res.status(400).json({
        error: `No se puede eliminar el producto. Tiene ${unidadesActivas} unidad(es) activa(s) en inventario.`,
      });
    }

    producto.eliminadoPor = await getUsuarioActual(req);
    await productoRepo.softRemove(producto);

    res.json({ message: 'Producto eliminado exitosamente' });
  }
}

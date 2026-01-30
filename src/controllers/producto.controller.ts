// ============================================
// ARCHIVO: src/controllers/producto.controller.ts (ACTUALIZADO)
// ============================================
import { Response } from 'express';
import { AppDataSource } from '../config/database';
import { Producto } from '../entities/Producto';
import { TipoQueso } from '../entities/TipoQueso';
import { Usuario } from '../entities/Usuario';
import { Unidad } from '../entities/Unidad';
import { AuthRequest } from '../middlewares/auth';

export class ProductoController {

  // POST /api/productos - Crear producto
  static async create(req: AuthRequest, res: Response) {
    try {
      const { plu, nombre, tipoQuesoId, seVendePorUnidad, precioPorKilo } = req.body;

      const productoRepo = AppDataSource.getRepository(Producto);
      const tipoRepo = AppDataSource.getRepository(TipoQueso);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      const tipoQueso = await tipoRepo.findOneBy({ id: tipoQuesoId });
      if (!tipoQueso) {
        return res.status(404).json({ error: 'Tipo de queso no encontrado' });
      }

      const existe = await productoRepo.findOneBy({ plu });
      if (existe) {
        return res.status(400).json({ error: 'PLU ya registrado' });
      }

      // 🆕 Obtener usuario que crea
      let usuarioCreador = null;
      if (req.user?.id) {
        usuarioCreador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      const producto = productoRepo.create({
        plu,
        nombre,
        tipoQueso,
        seVendePorUnidad,
        precioPorKilo: precioPorKilo ?? null,
        creadoPor: usuarioCreador, // 🆕
      });

      await productoRepo.save(producto);

      const productoCompleto = await productoRepo.findOne({
        where: { id: producto.id },
        relations: ['tipoQueso', 'creadoPor'],
      });

      res.status(201).json(productoCompleto);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
    
  }


  
  // GET /api/productos - Listar todos los productos
  static async getAll(req: AuthRequest, res: Response) {
    try {
      const productoRepo = AppDataSource.getRepository(Producto);
      const productos = await productoRepo.find({
        relations: ['tipoQueso', 'creadoPor', 'modificadoPor'],
        order: { nombre: 'ASC' },
      });
      res.json(productos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/productos/:id - Obtener un producto específico
  static async getOne(req: AuthRequest, res: Response) {
    try {
      const productoRepo = AppDataSource.getRepository(Producto);
      const producto = await productoRepo.findOne({
        where: { id: Number(req.params.id) },
        relations: ['tipoQueso', 'unidades', 'creadoPor', 'modificadoPor'],
      });

      if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      res.json(producto);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /api/productos/:id - Actualizar producto completo
  static async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { nombre, plu, seVendePorUnidad, precioPorKilo, tipoQuesoId } = req.body;

      const productoRepo = AppDataSource.getRepository(Producto);
      const tipoRepo = AppDataSource.getRepository(TipoQueso);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

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

      // 🆕 Obtener usuario que modifica
      let usuarioModificador = null;
      if (req.user?.id) {
        usuarioModificador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      if (nombre) producto.nombre = nombre;
      if (seVendePorUnidad !== undefined) producto.seVendePorUnidad = seVendePorUnidad;
      if (precioPorKilo !== undefined) producto.precioPorKilo = precioPorKilo;
      producto.modificadoPor = usuarioModificador; // 🆕

      await productoRepo.save(producto);

      const productoCompleto = await productoRepo.findOne({
        where: { id: Number(id) },
        relations: ['tipoQueso', 'creadoPor', 'modificadoPor'],
      });

      res.json(productoCompleto);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // PUT /api/productos/:id/precio - Actualizar solo precio
  static async updatePrecio(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { precioPorKilo } = req.body;

      const productoRepo = AppDataSource.getRepository(Producto);
      const usuarioRepo = AppDataSource.getRepository(Usuario);

      const producto = await productoRepo.findOneBy({ id: Number(id) });
      if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }

      // 🆕 Obtener usuario que modifica
      let usuarioModificador = null;
      if (req.user?.id) {
        usuarioModificador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      producto.precioPorKilo = precioPorKilo;
      producto.modificadoPor = usuarioModificador; // 🆕

      await productoRepo.save(producto);

      const productoCompleto = await productoRepo.findOne({
        where: { id: Number(id) },
        relations: ['tipoQueso', 'modificadoPor'],
      });

      res.json(productoCompleto);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // DELETE /api/productos/:id - Soft delete
      static async delete(req: AuthRequest, res: Response) {
        try {
          const productoRepo = AppDataSource.getRepository(Producto);
          const unidadRepo = AppDataSource.getRepository(Unidad);
          const usuarioRepo = AppDataSource.getRepository(Usuario);

          const producto = await productoRepo.findOne({
            where: { id: Number(req.params.id) },
            relations: ['unidades'], // Cargar unidades
          });
          
          if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
          }

          // 🆕 Verificar si tiene unidades activas
          const unidadesActivas = producto.unidades?.filter(u => u.activa && !u.deletedAt).length || 0;
          if (unidadesActivas > 0) {
            return res.status(400).json({ 
              error: `No se puede eliminar el producto. Tiene ${unidadesActivas} unidad(es) activa(s) en inventario.` 
            });
          }
      // 🆕 Obtener usuario que elimina
      let usuarioEliminador = null;
      if (req.user?.id) {
        usuarioEliminador = await usuarioRepo.findOneBy({ id: req.user.id });
      }

      producto.eliminadoPor = usuarioEliminador; // 🆕
      await productoRepo.softRemove(producto);

      res.json({ message: 'Producto eliminado exitosamente' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
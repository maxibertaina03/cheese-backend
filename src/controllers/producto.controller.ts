import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Producto } from '../entities/Producto';
import { TipoQueso } from '../entities/TipoQueso';

export class ProductoController {
static async create(req: Request, res: Response) {
  try {
    const { plu, nombre, tipoQuesoId, seVendePorUnidad } = req.body;

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
      precioPorKilo: req.body.precioPorKilo ?? null,
    });

    await productoRepo.save(producto);
    res.status(201).json(producto);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}


  // nuevo endpoint rápido para editar solo precio
  static async updatePrecio(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { precioPorKilo } = req.body;
      const repo = AppDataSource.getRepository(Producto);
      const prod = await repo.findOneBy({ id: Number(id) });
      if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });
      prod.precioPorKilo = precioPorKilo;
      await repo.save(prod);
      res.json(prod);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  static async getAll(req: Request, res: Response) {
    try {
      const productoRepo = AppDataSource.getRepository(Producto);
      const productos = await productoRepo.find({ relations: ['tipoQueso'] });
      res.json(productos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
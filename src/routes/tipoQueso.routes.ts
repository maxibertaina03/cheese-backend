import { Router } from 'express';
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { TipoQueso } from '../entities/TipoQueso';

const router = Router();
/* GET todos los tipos */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tipoQuesoRepo = AppDataSource.getRepository(TipoQueso);
    const tipos = await tipoQuesoRepo.find();
    res.json(tipos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/* POST crear tipo de queso */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({
        error: 'El campo nombre es obligatorio'
      });
    }

    const repo = AppDataSource.getRepository(TipoQueso);

    // evitar duplicados
    const existente = await repo.findOne({ where: { nombre } });
    if (existente) {
      return res.status(409).json({
        error: 'Ya existe un tipo de queso con ese nombre'
      });
    }

    const nuevo = repo.create({ nombre });
    await repo.save(nuevo);

    res.status(201).json(nuevo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear tipo de queso' });
  }
});


export default router;
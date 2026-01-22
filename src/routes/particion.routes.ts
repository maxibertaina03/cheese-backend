import { Router } from 'express';
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Particion } from '../entities/Particion';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const particionRepo = AppDataSource.getRepository(Particion);

    const particiones = await particionRepo.find({
      relations: ['unidad'],
    });

    res.json(particiones);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;


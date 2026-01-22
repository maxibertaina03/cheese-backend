import { Router } from 'express';
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Unidad } from '../entities/Unidad';
import { UnidadController } from '../controllers/unidad.controller';
import { auth, requireRole } from '../middlewares/auth';

const router = Router();

// Función para obtener historial completo
const getHistorial = async (req: Request, res: Response) => {
  try {
    const unidadRepo = AppDataSource.getRepository(Unidad);
    
    const unidades = await unidadRepo.find({
      relations: ['producto', 'producto.tipoQueso', 'particiones'],
      order: { createdAt: 'DESC' },
    });

    res.json(unidades);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ⚠️ IMPORTANTE: La ruta /historial debe ir ANTES de /:id para evitar conflictos
router.get('/historial', getHistorial);

// Rutas principales
router.post('/', auth, requireRole('admin'), UnidadController.create);
router.get('/', UnidadController.getAll);
router.post('/:id/particiones', auth, requireRole('admin'), UnidadController.addParticiones);
router.put('/:id', auth, requireRole('admin'), UnidadController.update);


export default router;
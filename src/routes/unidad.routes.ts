// ============================================
// ARCHIVO: src/routes/unidad.routes.ts (ACTUALIZADO)
// ============================================
import { Router } from 'express';
import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Unidad } from '../entities/Unidad';
import { UnidadController } from '../controllers/unidad.controller';
import { auth, requireRole } from '../middlewares/auth';
import {
  AddParticionDto,
  CreateUnidadDto,
  UnidadIdParamDto,
  UpdateUnidadDto,
} from '../dtos/unidad.dto';
import { validateDto } from '../middlewares/validation.middleware';

const router = Router();

// Función para obtener historial completo
const getHistorial = async (req: Request, res: Response) => {
  try {
    const unidadRepo = AppDataSource.getRepository(Unidad);
    
    const unidades = await unidadRepo.find({
      relations: [
        'producto',
        'producto.tipoQueso',
        'particiones',
        'particiones.motivo',
        'creadoPor',
        'modificadoPor',
      ],
      order: { createdAt: 'DESC' },
      withDeleted: true, // 🆕 Incluir registros eliminados
    });

    res.json(unidades);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ⚠️ IMPORTANTE: La ruta /historial debe ir ANTES de /:id
router.get('/historial', auth, getHistorial);

// Rutas principales
router.get('/', auth, UnidadController.getAll);
router.get('/:id', auth, validateDto(UnidadIdParamDto, 'params'), UnidadController.getOne);
router.post('/', auth, requireRole('admin'), validateDto(CreateUnidadDto), UnidadController.create);
router.put('/:id', auth, requireRole('admin'), validateDto(UnidadIdParamDto, 'params'), validateDto(UpdateUnidadDto), UnidadController.update);
router.delete('/:id', auth, requireRole('admin'), validateDto(UnidadIdParamDto, 'params'), UnidadController.delete);
router.delete('/:id/hard', auth, requireRole('admin'), validateDto(UnidadIdParamDto, 'params'), UnidadController.hardDelete);
router.post('/:id/particiones', auth, requireRole('admin'), validateDto(UnidadIdParamDto, 'params'), validateDto(AddParticionDto), UnidadController.addParticiones);

export default router;

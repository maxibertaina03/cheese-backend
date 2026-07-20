// ============================================
// ARCHIVO: src/routes/tipo-elemento.routes.ts
// ============================================
import { Request, Response, Router } from 'express';
import { AppDataSource } from '../../../config/database';
import { TipoElemento } from '../entities/TipoElemento';
import { TipoElementoController } from '../controllers/tipo-elemento.controller';
import { auth } from '../../../middlewares/auth';
import { asyncHandler } from '../../../compartido/middlewares/asyncHandler';

const router = Router();

// Todas las rutas requieren autenticación
router.use(auth);

// GET: Obtener todos los tipos de elemento (activos)
router.get('/', asyncHandler(TipoElementoController.getAll));

// GET: Obtener tipos para stock (solo los que llevan stock)
// ⚠️ Debe ir ANTES de /:id para no ser capturada como un id.
router.get(
  '/para-stock',
  asyncHandler(async (_req: Request, res: Response) => {
    const tipos = await AppDataSource.getRepository(TipoElemento).find({
      where: { activo: true, llevaStock: true },
      select: ['id', 'nombre', 'unidadMedida'],
      order: { nombre: 'ASC' },
    });
    res.json(tipos);
  })
);

// GET: Obtener un tipo por ID
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tipo = await AppDataSource.getRepository(TipoElemento).findOneBy({
      id: Number(req.params.id),
    });

    if (!tipo) {
      return res.status(404).json({ error: 'Tipo no encontrado' });
    }

    res.json(tipo);
  })
);

// POST: Crear nuevo tipo de elemento
router.post('/', asyncHandler(TipoElementoController.create));

// PUT: Actualizar tipo de elemento
router.put('/:id', asyncHandler(TipoElementoController.update));

// DELETE: Desactivar tipo de elemento
router.delete('/:id', asyncHandler(TipoElementoController.delete));

export default router;

// ============================================
// ARCHIVO: src/routes/tipo-elemento.routes.ts
// ============================================
import { Router } from 'express';
import { TipoElementoController } from '../controllers/tipo-elemento.controller';
import { auth } from '../middlewares/auth';

const router = Router();

// Todas las rutas requieren autenticación
router.use(auth);

// GET: Obtener todos los tipos de elemento (activos)
router.get('/', TipoElementoController.getAll);

// GET: Obtener tipos para stock (solo los que llevan stock)
router.get('/para-stock', async (req: any, res: any) => {
  try {
    const tipoRepo = (await import('../config/database')).AppDataSource.getRepository(
      (await import('../entities/TipoElemento')).TipoElemento
    );
    const tipos = await tipoRepo.find({
      where: { 
        activo: true,
        llevaStock: true 
      },
      select: ['id', 'nombre', 'unidadMedida'],
      order: { nombre: 'ASC' },
    });
    res.json(tipos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Obtener un tipo por ID
router.get('/:id', async (req: any, res: any) => {
  try {
    const tipoRepo = (await import('../config/database')).AppDataSource.getRepository(
      (await import('../entities/TipoElemento')).TipoElemento
    );
    const tipo = await tipoRepo.findOneBy({ id: Number(req.params.id) });
    
    if (!tipo) {
      return res.status(404).json({ error: 'Tipo no encontrado' });
    }
    
    res.json(tipo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Crear nuevo tipo de elemento
router.post('/', TipoElementoController.create);

// PUT: Actualizar tipo de elemento
router.put('/:id', TipoElementoController.update);

// DELETE: Desactivar tipo de elemento
router.delete('/:id', TipoElementoController.delete);

export default router;
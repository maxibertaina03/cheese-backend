// ============================================
// ARCHIVO: src/routes/producto.routes.ts (ACTUALIZADO)
// ============================================
import { Router } from 'express';
import { ProductoController } from '../controllers/producto.controller';
import { auth, requirePermiso } from '../middlewares/auth';
import { cacheMiddleware } from '../config/redis';

const router = Router();

router.get('/', auth, cacheMiddleware(300), ProductoController.getAll);
router.get('/:id', auth, ProductoController.getOne);
router.post('/', auth, requirePermiso('quesos'), ProductoController.create);
router.put('/:id', auth, requirePermiso('quesos'), ProductoController.update);
router.put('/:id/precio', auth, requirePermiso('quesos'), ProductoController.updatePrecio);
router.delete('/:id', auth, requirePermiso('quesos'), ProductoController.delete);

export default router;

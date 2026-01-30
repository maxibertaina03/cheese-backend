// ============================================
// ARCHIVO: src/routes/producto.routes.ts (ACTUALIZADO)
// ============================================
import { Router } from 'express';
import { ProductoController } from '../controllers/producto.controller';
import { auth, requireRole } from '../middlewares/auth';
import { cacheMiddleware } from '../config/redis';

const router = Router();

router.get('/', auth, ProductoController.getAll);
router.get('/:id', auth, ProductoController.getOne);
router.get('/', auth, cacheMiddleware(300), ProductoController.getAll);
router.post('/', auth, requireRole('admin'), ProductoController.create);
router.put('/:id', auth, requireRole('admin'), ProductoController.update);
router.put('/:id/precio', auth, requireRole('admin'), ProductoController.updatePrecio);
router.delete('/:id', auth, requireRole('admin'), ProductoController.delete);

export default router;
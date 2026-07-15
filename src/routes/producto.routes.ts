// ============================================
// ARCHIVO: src/routes/producto.routes.ts
// ============================================
import { Router } from 'express';
import { ProductoController } from '../controllers/producto.controller';
import { auth, requirePermiso } from '../middlewares/auth';
import { cacheMiddleware } from '../config/redis';
import { asyncHandler } from '../compartido/middlewares/asyncHandler';

const router = Router();

router.get('/', auth, cacheMiddleware(300), asyncHandler(ProductoController.getAll));
router.get('/:id', auth, asyncHandler(ProductoController.getOne));
router.post('/', auth, requirePermiso('quesos'), asyncHandler(ProductoController.create));
router.put('/:id', auth, requirePermiso('quesos'), asyncHandler(ProductoController.update));
router.put('/:id/precio', auth, requirePermiso('quesos'), asyncHandler(ProductoController.updatePrecio));
router.delete('/:id', auth, requirePermiso('quesos'), asyncHandler(ProductoController.delete));

export default router;

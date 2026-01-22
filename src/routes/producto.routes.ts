// producto.routes.ts
import { Router } from 'express';
import { ProductoController } from '../controllers/producto.controller';
import { auth, requireRole } from '../middlewares/auth';

const router = Router();

router.post('/', auth, requireRole('admin'), ProductoController.create);
router.get('/', auth, ProductoController.getAll);
router.put('/:id/precio', auth, requireRole('admin'), ProductoController.updatePrecio);

export default router;
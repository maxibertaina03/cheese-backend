// ============================================
// ARCHIVO: src/routes/stock-elemento.routes.ts (NUEVO)
// ============================================
import { Router } from 'express';
import { StockElementoController } from '../controllers/stock-elemento.controller';
import { TipoElementoController } from '../controllers/tipo-elemento.controller';
import { auth, requireRole } from '../middlewares/auth';

const router = Router();

// Rutas para Tipos de Elemento
router.get('/tipos', auth, TipoElementoController.getAll);
router.post('/tipos', auth, requireRole('admin'), TipoElementoController.create);
router.put('/tipos/:id', auth, requireRole('admin'), TipoElementoController.update);
router.delete('/tipos/:id', auth, requireRole('admin'), TipoElementoController.delete);

// Rutas para Stock
router.get('/', auth, StockElementoController.getAll);
router.post('/', auth, requireRole('admin'), StockElementoController.create);
router.put('/:id', auth, requireRole('admin'), StockElementoController.update);

// Movimientos de stock
router.post('/:id/ingreso', auth, requireRole('admin'), StockElementoController.ingresarStock);
router.post('/:id/egreso', auth, requireRole('admin'), StockElementoController.egresarStock);
router.post('/:id/ajuste', auth, requireRole('admin'), StockElementoController.ajusteStock);

// Reportes y consultas
router.get('/:id/movimientos', auth, StockElementoController.getMovimientos);
router.get('/reporte/bajos', auth, StockElementoController.getStockBajo);

export default router;
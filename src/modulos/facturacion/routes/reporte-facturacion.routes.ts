import { Router } from 'express';
import { ReporteFacturacionController } from '../controllers/reporte-facturacion.controller';
import { auth, requirePermiso } from '../../../middlewares/auth';

const router = Router();

router.get('/', auth, requirePermiso('facturacion'), ReporteFacturacionController.get);

export default router;

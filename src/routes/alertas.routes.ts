// src/routes/alertas.routes.ts
import { Router } from 'express';
import { AlertasController } from '../controllers/alertas.controller';
import { auth } from '../middlewares/auth';

const router = Router();

router.get('/', auth, AlertasController.getAlertas);

export default router;
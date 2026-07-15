// src/routes/alertas.routes.ts
import { Router } from 'express';
import { AlertasController } from '../controllers/alertas.controller';
import { auth } from '../middlewares/auth';
import { asyncHandler } from '../compartido/middlewares/asyncHandler';

const router = Router();

router.get('/', auth, asyncHandler(AlertasController.getAlertas));

export default router;

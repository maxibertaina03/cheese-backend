// ============================================
// ARCHIVO: src/app.ts (ACTUALIZADO)
// ============================================
import express from 'express';
import cors from 'cors';
import productoRoutes from './routes/producto.routes';
import unidadRoutes from './routes/unidad.routes';
import tipoQuesoRoutes from './routes/tipoQueso.routes';
import particionRoutes from './routes/particion.routes';
import motivoRoutes from './routes/motivo.routes';
import authRoutes from './routes/auth.routes';
import usuarioRoutes from './routes/usuario.routes';
import reportesRoutes from './routes/reportes.routes';
import alertasRoutes from './routes/alertas.routes';
import elementoRoutes from './routes/elemento.routes'; // 🆕
import stockElementoRoutes from './routes/stock-elemento.routes'; // 🆕
import tipoElementoRoutes from './routes/tipo-elemento.routes'; // 🆕
import logger, { requestLogger, errorHandler } from './utils/logger';

const app = express();

const localOrigins = ['http://localhost:3000', 'http://localhost:3001'];
const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowVercelPreviews = process.env.ALLOW_VERCEL_PREVIEWS === 'true';

const isAllowedOrigin = (origin: string | undefined) => {
  if (!origin) {
    return true;
  }

  if (localOrigins.includes(origin) || configuredOrigins.includes(origin)) {
    return true;
  }

  if (allowVercelPreviews && origin.endsWith('.vercel.app')) {
    return true;
  }

  if (!configuredOrigins.length && origin.includes('vercel.app')) {
    logger.warn('CORS_ORIGINS no configurado. Se acepta origen Vercel por compatibilidad temporal.');
    return true;
  }

  return false;
};

const corsOptions = {
  origin: function (origin: string | undefined, callback: any) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(requestLogger);

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/tipos-queso', tipoQuesoRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/unidades', unidadRoutes);
app.use('/api/particiones', particionRoutes);
app.use('/api/motivos', motivoRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/alertas', alertasRoutes);
app.use('/api/elementos', elementoRoutes); // 🆕
app.use('/api/stock-elementos', stockElementoRoutes); // 🆕
app.use('/api/tipos-elemento', tipoElementoRoutes); // 🆕

app.use(errorHandler);

app.get('/', (_req, res) => res.send('Cheese-stock API ok'));

export default app;

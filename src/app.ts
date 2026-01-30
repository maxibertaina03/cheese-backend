// ============================================
// ARCHIVO: src/app.ts (ACTUALIZADO)
// ============================================
import express from 'express';
import cors from 'cors';
import productoRoutes from './routes/producto.routes';
import unidadRoutes from './routes/unidad.routes';
import tipoQuesoRoutes from './routes/tipoQueso.routes';
import particionRoutes from './routes/particion.routes';
import motivoRoutes from './routes/motivo.routes'; // 🆕
import authRoutes from './routes/auth.routes';
import usuarioRoutes from './routes/usuario.routes';
import logger, { requestLogger, errorHandler } from './utils/logger';
import reportesRoutes from './routes/reportes.routes'; // ✨ NUEVO
import alertasRoutes from './routes/alertas.routes'; // ✨ NUEVO


const app = express();

const corsOptions = {
  origin: function (origin: string | undefined, callback: any) {
    if (!origin || 
        origin.includes('vercel.app') || 
        origin === 'http://localhost:3001') {
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
app.use('/api/motivos', motivoRoutes); // 🆕
app.use('/api/usuarios', usuarioRoutes);
app.use(errorHandler);
// ✨ NUEVAS RUTAS
app.use('/api/reportes', reportesRoutes);
app.use('/api/alertas', alertasRoutes);
app.get('/', (_req, res) => res.send('Cheese-stock API ok'));

export default app;
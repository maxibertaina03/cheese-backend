import express from 'express';
import cors from 'cors';
import productoRoutes from './routes/producto.routes';
import unidadRoutes from './routes/unidad.routes';
import tipoQuesoRoutes from './routes/tipoQueso.routes';
import particionRoutes from './routes/particion.routes';
import authRoutes from './routes/auth.routes';

const app = express();

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://cheese-stock-frontend-jsq7.vercel.app']
    : 'http://localhost:3001',
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api/tipos-queso', tipoQuesoRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/unidades', unidadRoutes);
app.use('/api/particiones', particionRoutes);
app.use('/api/auth', authRoutes);
app.get('/', (_req, res) => res.send('Cheese-stock API ok'));
console.log('✅ /api/auth routes mounted');
export default app;
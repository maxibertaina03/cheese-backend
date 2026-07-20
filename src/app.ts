// ============================================
// ARCHIVO: src/app.ts (ACTUALIZADO)
// ============================================
import express from 'express';
import cors, { CorsOptions } from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import productoRoutes from './modulos/inventario-quesos/routes/producto.routes';
import unidadRoutes from './modulos/inventario-quesos/routes/unidad.routes';
import tipoQuesoRoutes from './modulos/inventario-quesos/routes/tipoQueso.routes';
import particionRoutes from './modulos/inventario-quesos/routes/particion.routes';
import motivoRoutes from './modulos/inventario-quesos/routes/motivo.routes';
import authRoutes from './routes/auth.routes';
import usuarioRoutes from './routes/usuario.routes';
import reportesRoutes from './routes/reportes.routes';
import alertasRoutes from './routes/alertas.routes';
import elementoRoutes from './modulos/elementos/routes/elemento.routes'; // 🆕
import stockElementoRoutes from './modulos/elementos/routes/stock-elemento.routes'; // 🆕
import tipoElementoRoutes from './modulos/elementos/routes/tipo-elemento.routes'; // 🆕
import indumentariaRoutes from './modulos/indumentaria/routes/indumentaria.routes'; // 🆕
import proveedorRoutes from './modulos/indumentaria/routes/proveedor.routes'; // 🆕
// Módulo Facturación (bounded context)
import clienteRoutes from './modulos/facturacion/routes/cliente.routes';
import empresaRoutes from './modulos/facturacion/routes/empresa.routes';
import notaPedidoRoutes from './modulos/facturacion/routes/nota-pedido.routes';
import stockComercialRoutes from './modulos/facturacion/routes/stock-comercial.routes';
import reciboRoutes from './modulos/facturacion/routes/recibo.routes';
import notaCreditoRoutes from './modulos/facturacion/routes/nota-credito.routes';
import reporteFacturacionRoutes from './modulos/facturacion/routes/reporte-facturacion.routes';
import mantenimientoRoutes from './modulos/facturacion/routes/mantenimiento.routes';
import logger, { requestLogger, errorHandler } from './utils/logger';

const app = express();

// En producción (Render) la app corre detrás de un proxy; confiar en el
// primer proxy permite que el rate-limit identifique la IP real del cliente.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const localOrigins = ['http://localhost:3000', 'http://localhost:3001'];
const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowVercelPreviews = process.env.ALLOW_VERCEL_PREVIEWS === 'true';
const allowLocalOrigins = process.env.NODE_ENV !== 'production';

const isAllowedOrigin = (origin: string | undefined) => {
  if (!origin) {
    return true;
  }

  if (configuredOrigins.includes(origin)) {
    return true;
  }

  if (allowLocalOrigins && localOrigins.includes(origin)) {
    return true;
  }

  if (allowVercelPreviews && origin.endsWith('.vercel.app')) {
    return true;
  }

  return false;
};

const corsOptions: CorsOptions = {
  origin(origin, callback) {
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

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(requestLogger);

// En producción, evita filtrar detalles internos (mensajes de la DB, stack, etc.)
// al cliente: cualquier respuesta 5xx se loguea completa y se reemplaza por un
// mensaje genérico. En desarrollo se conserva el detalle para poder debuggear.
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode >= 500) {
        logger.error('Respuesta 5xx', { path: req.path, method: req.method, body });
        return originalJson({ error: 'Error interno del servidor' });
      }
      return originalJson(body);
    };
    next();
  });
}

// Limita intentos de login/registro para mitigar fuerza bruta.
// 20 intentos por IP cada 15 minutos; solo cuentan los requests fallidos.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' },
});

// Rutas
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
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
app.use('/api/indumentaria', indumentariaRoutes); // 🆕
app.use('/api/proveedores', proveedorRoutes); // 🆕
app.use('/api/clientes', clienteRoutes); // 🆕 facturación
app.use('/api/empresa', empresaRoutes); // 🆕 facturación
app.use('/api/notas-pedido', notaPedidoRoutes); // 🆕 facturación
app.use('/api/facturacion/stock-comercial', stockComercialRoutes); // 🆕 facturación
app.use('/api/recibos', reciboRoutes); // 🆕 facturación
app.use('/api/notas-credito', notaCreditoRoutes); // 🆕 facturación
app.use('/api/facturacion/reporte', reporteFacturacionRoutes); // 🆕 facturación
app.use('/api/facturacion/mantenimiento', mantenimientoRoutes); // 🆕 facturación (admin)

app.use(errorHandler);

app.get('/', (_req, res) => res.send('Cheese-stock API ok'));

export default app;

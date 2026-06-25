import 'reflect-metadata';
import app from './app';
import { AppDataSource } from './config/database';
import { ensureSchema } from './config/ensureSchema';

const PORT = process.env.PORT || 3000;

AppDataSource.initialize()
  .then(async () => {
    console.log('✅ Database connected');
    // Asegura columnas/tablas nuevas en producción (synchronize está off allí).
    // Es aditivo e idempotente, así que es seguro correrlo siempre.
    await ensureSchema(AppDataSource);
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => console.log('❌ Database connection error:', error));
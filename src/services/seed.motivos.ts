// ============================================
// ARCHIVO: src/services/seed.motivos.ts (NUEVO)
// ============================================
import { AppDataSource } from '../config/database';
import { Motivo } from '../modulos/inventario-quesos/entities/Motivo';

const motivosPredefinidos = [
  {
    nombre: 'Venta',
    descripcion: 'Venta normal al cliente',
  },
  {
    nombre: 'Cata',
    descripcion: 'Degustación o prueba de producto',
  },
  {
    nombre: 'Tabla',
    descripcion: 'Uso en tablas de quesos',
  },
  {
    nombre: 'Publicidad',
    descripcion: 'Marketing y promoción',
  },
  {
    nombre: 'Merma',
    descripcion: 'Pérdida de producto por deterioro',
  },
  {
    nombre: 'Consumo Interno',
    descripcion: 'Uso del personal',
  },
  {
    nombre: 'Cortesía',
    descripcion: 'Regalo o atención especial',
  },
  {
    nombre: 'Muestreo',
    descripcion: 'Muestras gratis para clientes',
  },
  {
    nombre: 'Evento',
    descripcion: 'Uso en eventos especiales',
  },
  {
    nombre: 'Otros',
    descripcion: 'Otros motivos no especificados',
  },
];

export async function seedMotivos() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const motivoRepo = AppDataSource.getRepository(Motivo);

    console.log('🌱 Iniciando seed de motivos...');

    for (const motivoData of motivosPredefinidos) {
      // Verificar si ya existe
      const existe = await motivoRepo.findOne({
        where: { nombre: motivoData.nombre },
      });

      if (!existe) {
        const motivo = motivoRepo.create(motivoData);
        await motivoRepo.save(motivo);
        console.log(`✅ Motivo creado: ${motivoData.nombre}`);
      } else {
        console.log(`⏭️  Motivo ya existe: ${motivoData.nombre}`);
      }
    }

    console.log('🎉 Seed de motivos completado');
  } catch (error) {
    console.error('❌ Error en seed de motivos:', error);
    throw error;
  }
}

// Ejecutar directamente si se llama como script
if (require.main === module) {
  seedMotivos()
    .then(() => {
      console.log('✅ Script finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}
import { DataSource } from 'typeorm';

// Sincronización de esquema SEGURA y ADITIVA para producción, donde TypeORM corre con
// `synchronize: false`. Solo agrega columnas/tablas que falten (IF NOT EXISTS); nunca
// altera ni elimina nada existente, así que es idempotente y seguro de correr en cada
// arranque. Reemplaza a las migraciones (el proyecto no usa migraciones).
//
// IMPORTANTE: los nombres de columna/tabla van entre comillas porque TypeORM usa
// identificadores camelCase (sensibles a mayúsculas en PostgreSQL).
const STATEMENTS: string[] = [
  // Nuevas columnas de facturación en tablas existentes
  'ALTER TABLE "productos" ADD COLUMN IF NOT EXISTS "precioUnitario" numeric(10,2)',
  'ALTER TABLE "elementos" ADD COLUMN IF NOT EXISTS "precioUnitario" numeric(10,2) DEFAULT 0',
  'ALTER TABLE "elementos" ADD COLUMN IF NOT EXISTS "esVendible" boolean DEFAULT false',
  'ALTER TABLE "unidades" ADD COLUMN IF NOT EXISTS "fechaElaboracion" date',
  'ALTER TABLE "unidades" ADD COLUMN IF NOT EXISTS "numeroLote" varchar(100)',

  // Tabla de clientes (facturación)
  `CREATE TABLE IF NOT EXISTS "clientes" (
    "id" SERIAL PRIMARY KEY,
    "nombre" varchar(200) NOT NULL,
    "tipoDocumento" varchar(10) NOT NULL DEFAULT 'DNI',
    "numeroDocumento" varchar(20),
    "direccion" varchar(250),
    "codigoPostal" varchar(20),
    "localidad" varchar(150),
    "provincia" varchar(150),
    "telefono" varchar(50),
    "email" varchar(150),
    "activo" boolean NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    "deletedAt" TIMESTAMP,
    "creadoPorId" integer,
    "modificadoPorId" integer,
    "eliminadoPorId" integer
  )`,

  // Tabla de datos de la empresa emisora (singleton)
  `CREATE TABLE IF NOT EXISTS "empresa" (
    "id" SERIAL PRIMARY KEY,
    "razonSocial" varchar(200) NOT NULL DEFAULT '',
    "cuit" varchar(20),
    "direccion" varchar(250),
    "codigoPostal" varchar(20),
    "localidad" varchar(150),
    "provincia" varchar(150),
    "telefono" varchar(50),
    "email" varchar(150),
    "condicionIva" varchar(100),
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
  )`,
];

export async function ensureSchema(dataSource: DataSource): Promise<void> {
  for (const statement of STATEMENTS) {
    try {
      await dataSource.query(statement);
    } catch (error: any) {
      // No abortamos: una sentencia que falle no debe impedir el arranque ni las demás.
      console.error('⚠️ ensureSchema: error ejecutando sentencia:', error?.message || error);
    }
  }
  console.log('✅ ensureSchema: esquema verificado');
}

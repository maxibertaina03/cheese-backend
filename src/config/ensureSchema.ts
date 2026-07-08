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

  // --- Fase 2: notas de pedido ---
  // Fecha de venta del queso (cuando se vende queda activa=false + fechaVenta)
  'ALTER TABLE "unidades" ADD COLUMN IF NOT EXISTS "fechaVenta" timestamp',

  // Secuencia de numeración por tipo de comprobante (1=pedido, 2=recibo, 3=crédito)
  `CREATE TABLE IF NOT EXISTS "secuencias_comprobante" (
    "tipo" integer PRIMARY KEY,
    "prefijo" varchar(10) NOT NULL DEFAULT '1',
    "ultimoNumero" integer NOT NULL DEFAULT 0
  )`,
  `INSERT INTO "secuencias_comprobante" ("tipo","prefijo","ultimoNumero")
    VALUES (1,'1',0) ON CONFLICT ("tipo") DO NOTHING`,

  `CREATE TABLE IF NOT EXISTS "notas_pedido" (
    "id" SERIAL PRIMARY KEY,
    "serie" varchar(10) NOT NULL DEFAULT '1',
    "numero" integer NOT NULL,
    "total" numeric(12,2) NOT NULL DEFAULT 0,
    "saldoPendiente" numeric(12,2) NOT NULL DEFAULT 0,
    "estado" varchar(20) NOT NULL DEFAULT 'confirmada',
    "observaciones" text,
    "fecha" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    "deletedAt" TIMESTAMP,
    "clienteId" integer,
    "creadoPorId" integer
  )`,

  `CREATE TABLE IF NOT EXISTS "notas_pedido_items" (
    "id" SERIAL PRIMARY KEY,
    "tipoItem" varchar(20) NOT NULL,
    "descripcion" varchar(250) NOT NULL,
    "plu" varchar(20),
    "pesoGramos" numeric(10,2),
    "fechaElaboracion" date,
    "cantidad" integer NOT NULL DEFAULT 1,
    "precioUnitario" numeric(12,2) NOT NULL DEFAULT 0,
    "subtotal" numeric(12,2) NOT NULL DEFAULT 0,
    "notaPedidoId" integer,
    "unidadId" integer,
    "elementoId" integer
  )`,
  // Ítems de nota de pedido ahora referencian el producto (venta por cantidad)
  'ALTER TABLE "notas_pedido_items" ADD COLUMN IF NOT EXISTS "productoId" integer',

  // --- Stock comercial (facturación, por cantidad) ---
  `CREATE TABLE IF NOT EXISTS "stock_comercial" (
    "id" SERIAL PRIMARY KEY,
    "productoId" integer NOT NULL UNIQUE,
    "cantidadDisponible" integer NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "movimientos_stock_comercial" (
    "id" SERIAL PRIMARY KEY,
    "productoId" integer NOT NULL,
    "tipo" varchar(20) NOT NULL,
    "cantidad" integer NOT NULL,
    "stockAnterior" integer NOT NULL,
    "stockNuevo" integer NOT NULL,
    "referencia" varchar(60),
    "observaciones" text,
    "creadoPorId" integer,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now()
  )`,
  // Datos de compra en el ingreso de stock comercial
  'ALTER TABLE "movimientos_stock_comercial" ADD COLUMN IF NOT EXISTS "fechaComprobante" date',
  'ALTER TABLE "movimientos_stock_comercial" ADD COLUMN IF NOT EXISTS "comprobantePrefijo" varchar(20)',
  'ALTER TABLE "movimientos_stock_comercial" ADD COLUMN IF NOT EXISTS "comprobanteNumero" varchar(30)',
  'ALTER TABLE "movimientos_stock_comercial" ADD COLUMN IF NOT EXISTS "precioCompra" numeric(12,2)',
  'ALTER TABLE "movimientos_stock_comercial" ADD COLUMN IF NOT EXISTS "proveedorId" integer',

  // --- Fase 3: recibos (serie 2) ---
  `INSERT INTO "secuencias_comprobante" ("tipo","prefijo","ultimoNumero")
    VALUES (2,'2',0) ON CONFLICT ("tipo") DO NOTHING`,
  `CREATE TABLE IF NOT EXISTS "recibos" (
    "id" SERIAL PRIMARY KEY,
    "serie" varchar(10) NOT NULL DEFAULT '2',
    "numero" integer NOT NULL,
    "clienteId" integer NOT NULL,
    "montoTotal" numeric(12,2) NOT NULL DEFAULT 0,
    "medioPago" varchar(20) NOT NULL,
    "observaciones" text,
    "fecha" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    "deletedAt" TIMESTAMP,
    "creadoPorId" integer
  )`,
  `CREATE TABLE IF NOT EXISTS "recibos_aplicaciones" (
    "id" SERIAL PRIMARY KEY,
    "reciboId" integer NOT NULL,
    "notaPedidoId" integer NOT NULL,
    "numeroNota" varchar(20),
    "monto" numeric(12,2) NOT NULL DEFAULT 0
  )`,
  // Formas de pago de un recibo (permite pago mixto)
  `CREATE TABLE IF NOT EXISTS "recibos_pagos" (
    "id" SERIAL PRIMARY KEY,
    "reciboId" integer NOT NULL,
    "medio" varchar(20) NOT NULL,
    "monto" numeric(12,2) NOT NULL DEFAULT 0
  )`,

  // --- Fase 4: notas de crédito (serie 3) ---
  `INSERT INTO "secuencias_comprobante" ("tipo","prefijo","ultimoNumero")
    VALUES (3,'3',0) ON CONFLICT ("tipo") DO NOTHING`,
  `CREATE TABLE IF NOT EXISTS "notas_credito" (
    "id" SERIAL PRIMARY KEY,
    "serie" varchar(10) NOT NULL DEFAULT '3',
    "numero" integer NOT NULL,
    "notaPedidoId" integer NOT NULL,
    "clienteId" integer NOT NULL,
    "montoTotal" numeric(12,2) NOT NULL DEFAULT 0,
    "motivo" text,
    "fecha" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    "deletedAt" TIMESTAMP,
    "creadoPorId" integer
  )`,
  `CREATE TABLE IF NOT EXISTS "notas_credito_items" (
    "id" SERIAL PRIMARY KEY,
    "notaCreditoId" integer NOT NULL,
    "notaPedidoItemId" integer NOT NULL,
    "tipoItem" varchar(20) NOT NULL,
    "productoId" integer,
    "elementoId" integer,
    "descripcion" varchar(250) NOT NULL,
    "plu" varchar(20),
    "cantidad" integer NOT NULL DEFAULT 1,
    "precioUnitario" numeric(12,2) NOT NULL DEFAULT 0,
    "subtotal" numeric(12,2) NOT NULL DEFAULT 0
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

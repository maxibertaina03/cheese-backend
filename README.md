# Cheese Backend

Backend del sistema de stock de quesos y elementos de apoyo de **Las Tres Estrellas**.

Expone una API REST en Node.js + Express + TypeORM sobre PostgreSQL para:

- autenticar usuarios con JWT
- administrar productos y tipos de queso
- registrar ingresos de hormas o unidades
- descontar peso mediante cortes o particiones
- conservar historial y trazabilidad de movimientos
- administrar motivos de ingreso, egreso y corte
- gestionar usuarios con roles
- consultar alertas y reportes para dashboard
- llevar un stock paralelo de elementos o insumos no queso

## Que resuelve este sistema

El sistema fue pensado para controlar el inventario operativo de una queseria.

Cada **producto** representa una variedad comercial. Sobre ese producto se crean **unidades** con peso inicial y peso actual. Cuando una pieza se corta o se vende parcialmente, se registran **particiones** que descuentan peso y dejan trazabilidad del motivo y del usuario que hizo la accion.

Ademas del stock de quesos, el backend tambien maneja un modulo de **elementos**, util para controlar insumos, accesorios o materiales con ingresos, egresos e historial de movimientos.

## Modulos principales

### Autenticacion y permisos

- login y registro de usuarios
- emision y validacion de JWT
- roles `admin` y `usuario`
- proteccion de rutas con middleware de autenticacion
- acciones sensibles restringidas a administradores

### Inventario de quesos

- ABM de tipos de queso
- ABM de productos
- alta de unidades con peso inicial
- edicion y baja logica de unidades
- historial de unidades activas e inactivas
- cortes parciales o egreso total mediante particiones
- relacion de cada movimiento con un motivo

### Motivos y auditoria

- catalogo de motivos reutilizable
- asociacion de motivos a ingresos, cortes y egresos
- campos de auditoria `creadoPor`, `modificadoPor`, `eliminadoPor`
- soft delete en varias entidades

### Reportes y alertas

- dashboard general
- ventas
- top de productos
- inventario valorizado
- alertas de stock o seguimiento operativo

### Elementos e insumos

- alta, edicion y baja de elementos
- registro de ingresos y egresos
- historial de movimientos por elemento
- stock disponible y acumulado historico

## Entidades principales

- `TipoQueso`: clasificacion del producto
- `Producto`: articulo comercial, con nombre, PLU y precio
- `Unidad`: pieza individual con peso y estado
- `Particion`: corte o descuento de peso sobre una unidad
- `Motivo`: motivo operativo para registrar movimientos
- `Usuario`: acceso al sistema y rol
- `Elemento`: insumo o material controlado fuera del stock de quesos
- `MovimientoElemento`: historial de ingresos y egresos de elementos

## Rutas principales

Base URL: `/api`

- `POST /auth/login`
- `POST /auth/register`
- `GET /auth/verify`
- `GET|POST|PUT|DELETE /tipos-queso`
- `GET|POST|PUT|DELETE /productos`
- `GET|POST|PUT|DELETE /unidades`
- `GET /unidades/historial`
- `POST /unidades/:id/particiones`
- `GET|PUT|DELETE /particiones`
- `GET|POST|PUT|DELETE /motivos`
- `GET|PUT|DELETE /usuarios`
- `GET /reportes/dashboard`
- `GET /reportes/ventas`
- `GET /reportes/top-productos`
- `GET /reportes/inventario-valorizado`
- `GET /alertas`
- `GET|POST|PUT|DELETE /elementos`
- `GET /elementos/:id/movimientos`
- `POST /elementos/:id/ingreso`
- `POST /elementos/:id/egreso`

## Stack

- Node.js
- Express
- TypeScript
- TypeORM
- PostgreSQL
- JWT
- bcryptjs
- Redis opcional
- nodemailer opcional

## Variables de entorno

El repo incluye `.env.example` con la base de configuracion.

Variables relevantes:

- `PORT`
- `NODE_ENV`
- `JWT_SECRET`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `REDIS_URL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `ADMIN_EMAIL`
- `LOG_LEVEL`

## Scripts

- `npm run dev`: desarrollo con recarga
- `npm run build`: compila TypeScript a `dist/`
- `npm start`: ejecuta el build compilado
- `npm run seed`: corre el seed

## Puesta en marcha local

1. Instalar dependencias con `npm install`
2. Crear `.env` a partir de `.env.example`
3. Configurar PostgreSQL
4. Ejecutar `npm run dev`

La API queda disponible por defecto en `http://localhost:3000`.

## Relacion con el frontend

Este backend esta pensado para ser consumido por el repositorio `cheese-frontend`, que usa autenticacion por token y consulta esta API para inventario, historial, dashboard, administracion y elementos.

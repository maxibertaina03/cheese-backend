-- ============================================================
-- Tablas: Proveedores + Indumentaria + Movimientos de Indumentaria
-- Para ejecutar en la base de PRODUCCIÓN (Render), donde
-- synchronize=false y las tablas NO se crean solas.
--
-- En LOCAL no hace falta correr esto: con NODE_ENV!=production
-- TypeORM (synchronize=true) crea estas tablas automáticamente.
--
-- Las columnas camelCase van entre comillas dobles para preservar
-- la mayúscula, igual que las crea TypeORM. La tabla de usuarios
-- se llama "usuario" (singular).
-- ============================================================

BEGIN;

-- ----------------------------------------------------------------
-- proveedores
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proveedores (
    id              SERIAL PRIMARY KEY,
    nombre          varchar(200) NOT NULL,
    contacto        varchar(200),
    telefono        varchar(50),
    email           varchar(150),
    direccion       varchar(250),
    observaciones   text,
    activo          boolean NOT NULL DEFAULT true,
    "creadoPorId"    integer REFERENCES usuario(id),
    "modificadoPorId" integer REFERENCES usuario(id),
    "eliminadoPorId" integer REFERENCES usuario(id),
    "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt"      TIMESTAMP NOT NULL DEFAULT now(),
    "deletedAt"      TIMESTAMP
);

-- ----------------------------------------------------------------
-- indumentaria
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS indumentaria (
    id                        SERIAL PRIMARY KEY,
    nombre                    varchar(200) NOT NULL,
    categoria                 varchar(50),
    talle                     varchar(20),
    color                     varchar(50),
    genero                    varchar(20),
    ubicacion                 varchar(200),
    "cantidadDisponible"      integer NOT NULL DEFAULT 0,
    "cantidadTotalIngresada"  integer NOT NULL DEFAULT 0,
    "stockMinimo"             integer NOT NULL DEFAULT 0,
    "proveedorId"             integer REFERENCES proveedores(id),
    observaciones             text,
    activo                    boolean NOT NULL DEFAULT true,
    "creadoPorId"             integer REFERENCES usuario(id),
    "modificadoPorId"         integer REFERENCES usuario(id),
    "eliminadoPorId"          integer REFERENCES usuario(id),
    "createdAt"               TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt"               TIMESTAMP NOT NULL DEFAULT now(),
    "deletedAt"               TIMESTAMP
);

-- ----------------------------------------------------------------
-- movimientos_indumentaria
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos_indumentaria (
    id                     SERIAL PRIMARY KEY,
    "indumentariaId"       integer REFERENCES indumentaria(id),
    tipo                   varchar(20) NOT NULL,
    cantidad               integer NOT NULL,
    "stockAnterior"        integer NOT NULL,
    "stockNuevo"           integer NOT NULL,
    destino                varchar(200),
    "proveedorId"          integer REFERENCES proveedores(id),
    "documentoReferencia"  varchar(200),
    observaciones          text,
    "fechaMovimiento"      date NOT NULL,
    "usuarioId"            integer REFERENCES usuario(id),
    "createdAt"            TIMESTAMP NOT NULL DEFAULT now()
);

-- Índices útiles para los listados/filtros más comunes
CREATE INDEX IF NOT EXISTS idx_indumentaria_activo      ON indumentaria (activo);
CREATE INDEX IF NOT EXISTS idx_indumentaria_proveedor   ON indumentaria ("proveedorId");
CREATE INDEX IF NOT EXISTS idx_mov_indumentaria_prenda  ON movimientos_indumentaria ("indumentariaId");

COMMIT;

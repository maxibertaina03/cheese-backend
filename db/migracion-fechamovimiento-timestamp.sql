-- ============================================================
-- Migración: fechaMovimiento de date -> timestamp
--
-- Correr UNA vez en la base de PRODUCCIÓN (Render).
-- En producción synchronize=false, así que este cambio NO se
-- aplica solo: hay que ejecutarlo a mano.
--
-- Es idempotente y seguro:
--   - Solo modifica la columna si todavía es de tipo 'date'.
--   - No falla si la tabla no existe.
--   - Preserva los datos existentes (los convierte a timestamp;
--     las filas viejas quedan a medianoche, porque esa hora
--     nunca se había guardado).
-- ============================================================

BEGIN;

-- movimientos_indumentaria
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'movimientos_indumentaria'
      AND column_name = 'fechaMovimiento'
      AND data_type = 'date'
  ) THEN
    ALTER TABLE movimientos_indumentaria
      ALTER COLUMN "fechaMovimiento" TYPE timestamp
      USING "fechaMovimiento"::timestamp;
  END IF;
END $$;

-- movimientos_stock
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'movimientos_stock'
      AND column_name = 'fechaMovimiento'
      AND data_type = 'date'
  ) THEN
    ALTER TABLE movimientos_stock
      ALTER COLUMN "fechaMovimiento" TYPE timestamp
      USING "fechaMovimiento"::timestamp;
  END IF;
END $$;

COMMIT;

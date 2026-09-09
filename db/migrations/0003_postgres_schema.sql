-- Pone las migraciones de acuerdo con la base que se usa de verdad.
--
-- 0001 y 0002 se escribieron para SQLite/D1, cuando el backend era un Worker
-- de Cloudflare: `active INTEGER`, `price REAL`, `updated_at TEXT`. Hoy los
-- datos viven en Postgres (Supabase) y la tabla real se creó a mano, así que
-- correr aquellas migraciones sobre una base vacía NO reproducía lo que hay en
-- producción: `active` es booleano y la API compara `active = true`, que en
-- Postgres contra una columna integer directamente falla.
--
-- Esto es idempotente y seguro de repetir. No toca image_key: ninguna foto se
-- ve afectada.

CREATE TABLE IF NOT EXISTS products (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  code         text,
  cost         numeric,
  price        numeric NOT NULL DEFAULT 0,
  stock        integer,
  category     text NOT NULL DEFAULT 'varios',
  active       boolean NOT NULL DEFAULT true,
  image_key    text,
  import_batch text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

-- El catálogo público solo lista productos activos, ordenados por sección y
-- después por nombre. Un índice parcial cubre exactamente esa consulta y no
-- carga con las filas dadas de baja, que son la mayoría con el tiempo.
CREATE INDEX IF NOT EXISTS idx_products_active_category_name
  ON products (category, name)
  WHERE active;

-- "Qué falta fotografiar" es el trabajo diario del panel sobre 15.000 filas.
-- Sin esto, cada apertura del panel recorre la tabla entera.
CREATE INDEX IF NOT EXISTS idx_products_active_sin_foto
  ON products (name)
  WHERE active AND image_key IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_code ON products (code);

-- ---------------------------------------------------------------------------
-- Búsqueda
-- ---------------------------------------------------------------------------
--
-- La API busca con una expresión regular sin distinguir mayúsculas (`~*`), que
-- es lo que permite que "cotillón" encuentre "COTILLON" y "pinata" encuentre
-- "PIÑATA" sin depender de la extensión unaccent.
--
-- pg_trgm le permite al planificador usar un índice para ese operador en vez
-- de recorrer la tabla. Es opcional: sin él la búsqueda funciona igual, solo
-- que escaneando (hoy, con 15.152 filas, tarda unos 250 ms). Vale la pena
-- cuando el catálogo crezca o si la búsqueda se siente lenta.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING gin (name gin_trgm_ops);

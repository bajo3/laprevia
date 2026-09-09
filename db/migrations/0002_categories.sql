-- HISTÓRICO — no correr sobre la base actual.
-- Escrita para SQLite/D1, cuando el backend era un Worker de Cloudflare.
-- El esquema vigente (Postgres/Supabase) está en 0003_postgres_schema.sql.

-- Reemplaza la sección "almacen" por el cajón general "varios".
--
-- No hace falta correr esto a mano: la app entiende las dos formas y el panel
-- va reescribiendo las filas a medida que se ubican los productos. Correrlo
-- deja la base prolija de una vez y es seguro repetirlo.
--
-- Ninguna de estas sentencias toca image_key: las fotos no se ven afectadas.

UPDATE products SET category = 'varios' WHERE category = 'almacen';

-- Cualquier sección que ya no exista también cae al cajón general.
UPDATE products
SET category = 'varios'
WHERE category NOT IN (
  'cotillon', 'reposteria', 'descartables', 'golosinas', 'snacks',
  'galletitas', 'helados', 'sahumerios', 'importados', 'regalos', 'varios'
);

-- Los productos nuevos que entren sin sección quedan en el cajón general.
ALTER TABLE products ALTER COLUMN category SET DEFAULT 'varios';

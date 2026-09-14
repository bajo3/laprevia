-- Las secciones dejan de vivir en el código y pasan a la base.
--
-- Hasta acá la lista estaba escrita a mano en tres archivos (el frontend, la
-- API y estas migraciones) y agregar una sección era un deploy. El negocio
-- cambia de rubro más seguido que eso: ahora se administran desde /admin.
--
-- Es idempotente y seguro de repetir. No toca la tabla products: la columna
-- `category` sigue guardando el slug, que no cambia nunca aunque se renombre
-- la sección. Por eso renombrar no reescribe ninguna fila de producto.

CREATE TABLE IF NOT EXISTS categories (
  slug       text PRIMARY KEY,
  label      text NOT NULL,
  emoji      text NOT NULL DEFAULT '🏷️',
  color      text NOT NULL DEFAULT 'var(--color-ink)',
  position   integer NOT NULL DEFAULT 0,
  -- "Varios" es el cajón general: es adonde caen los productos de una sección
  -- que se elimina, así que no se puede eliminar a su vez. Es la única fila
  -- protegida, y se protege acá y no en el código para que siga siendo cierto
  -- si alguien escribe en la tabla por fuera del panel.
  protected  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_position ON categories (position);

-- Las once secciones que existían escritas en el código. ON CONFLICT DO
-- NOTHING deja intacto lo que la tienda ya haya cambiado desde el panel.
INSERT INTO categories (slug, label, emoji, color, position, protected) VALUES
  ('cotillon',    'Cotillón',    '🎉',  'var(--color-pink)',        1,  false),
  ('reposteria',  'Repostería',  '🧁',  'var(--color-teal-dark)',   2,  false),
  ('descartables','Descartables','🥤',  'var(--color-blue)',        3,  false),
  ('golosinas',   'Golosinas',   '🍬',  'var(--color-violet)',      4,  false),
  ('snacks',      'Snacks',      '🍟',  'var(--color-orange)',      5,  false),
  ('galletitas',  'Galletitas',  '🍪',  'var(--color-orange)',      6,  false),
  ('helados',     'Helados',     '🍦',  'var(--color-teal)',        7,  false),
  ('sahumerios',  'Sahumerios',  '🕯️', 'var(--color-violet-dark)', 8,  false),
  ('importados',  'Importados',  '🌐',  'var(--color-yellow)',      9,  false),
  ('regalos',     'Regalos',     '🎁',  'var(--color-pink-dark)',   10, false),
  -- Último a propósito: es el cajón de lo que todavía no se ubicó, no una
  -- sección real del negocio.
  ('varios',      'Varios',      '🛒',  'var(--color-ink)',         999, true)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  cost REAL,
  price REAL NOT NULL DEFAULT 0,
  stock INTEGER,
  category TEXT NOT NULL DEFAULT 'almacen',
  active INTEGER NOT NULL DEFAULT 1,
  image_key TEXT,
  import_batch TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_active_name ON products(active, name);
CREATE INDEX IF NOT EXISTS idx_products_category_name ON products(category, name);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);

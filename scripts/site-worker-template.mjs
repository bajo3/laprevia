const assets = __EMBEDDED_ASSETS__;

const PRODUCT_SCHEMA = `CREATE TABLE IF NOT EXISTS products (
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
)`;

let schemaPromise;

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(init.headers ?? {}),
    },
  });
}

async function ensureSchema(env) {
  if (!env?.DB) return false;
  if (!schemaPromise) {
    schemaPromise = env.DB
      .batch([
        env.DB.prepare(PRODUCT_SCHEMA),
        env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_products_active_name ON products(active, name)"),
        env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_products_category_name ON products(category, name)"),
        env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_products_code ON products(code)"),
      ])
      .then(() => true)
      .catch((error) => {
        schemaPromise = undefined;
        throw error;
      });
  }
  return schemaPromise;
}

function productImageKey(id) {
  return `products/${encodeURIComponent(id)}`;
}

function newProductImageKey(id) {
  return `${productImageKey(id)}/${crypto.randomUUID()}`;
}

function productImageUrl(id, key) {
  const base = `/api/products/${encodeURIComponent(id)}/image`;
  if (!key) return base;
  const version = String(key).split("/").at(-1);
  return `${base}?v=${encodeURIComponent(version)}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || min, min), max);
}

function adminAuthorized(request, env) {
  const configuredToken = env?.ADMIN_TOKEN;
  if (!configuredToken) return false;
  return request.headers.get("Authorization") === `Bearer ${configuredToken}`;
}

async function listProducts(request, env) {
  if (!(await ensureSchema(env))) return json({ error: "Database not configured" }, { status: 503 });

  const url = new URL(request.url);
  const limit = clamp(url.searchParams.get("limit"), 1, 25000);
  const offset = clamp(url.searchParams.get("offset"), 0, 1000000);
  const query = (url.searchParams.get("q") ?? "").trim();
  const category = (url.searchParams.get("category") ?? "").trim();
  const filters = ["active = 1"];
  const binds = [];

  if (query) {
    filters.push("(name LIKE ? OR id LIKE ? OR COALESCE(code, '') LIKE ?)");
    const like = `%${query}%`;
    binds.push(like, like, like);
  }
  if (category) {
    filters.push("category = ?");
    binds.push(category);
  }

  const where = filters.join(" AND ");
  const countResult = await env.DB.prepare(`SELECT COUNT(*) AS total FROM products WHERE ${where}`).bind(...binds).first();
  const rows = await env.DB
    .prepare(`SELECT id, name, code, price, stock, category, image_key FROM products WHERE ${where} ORDER BY name COLLATE NOCASE LIMIT ? OFFSET ?`)
    .bind(...binds, limit, offset)
    .all();

  return json({
    total: Number(countResult?.total ?? 0),
    products: (rows.results ?? []).map((product) => ({
      id: String(product.id),
      name: product.name,
      code: product.code || undefined,
      price: Number(product.price ?? 0),
      stock: product.stock === null ? undefined : Number(product.stock),
      category: product.category,
      unit: "un",
      image: product.image_key ? productImageUrl(product.id, product.image_key) : undefined,
    })),
  });
}

async function importProducts(request, env) {
  if (!env?.ADMIN_TOKEN) return json({ error: "Admin token not configured" }, { status: 503 });
  if (!adminAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
  if (!(await ensureSchema(env))) return json({ error: "Database not configured" }, { status: 503 });

  const body = await request.json();
  const incoming = Array.isArray(body?.products) ? body.products : [];
  if (!incoming.length) return json({ error: "No products received" }, { status: 400 });

  const importBatch = crypto.randomUUID();
  const now = new Date().toISOString();
  const statements = incoming.map((product) =>
    env.DB
      .prepare(`INSERT INTO products (id, name, code, cost, price, stock, category, active, image_key, import_batch, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          code = excluded.code,
          cost = excluded.cost,
          price = excluded.price,
          stock = excluded.stock,
          category = excluded.category,
          active = 1,
          import_batch = excluded.import_batch,
          updated_at = excluded.updated_at`)
      .bind(
        String(product.id),
        String(product.name),
        product.code ? String(product.code) : null,
        Number.isFinite(Number(product.cost)) ? Number(product.cost) : null,
        Number(product.price ?? 0),
        Number.isFinite(Number(product.stock)) ? Number(product.stock) : null,
        String(product.category || "almacen"),
        importBatch,
        now,
      ),
  );

  for (let index = 0; index < statements.length; index += 100) {
    await env.DB.batch(statements.slice(index, index + 100));
  }
  await env.DB.prepare("UPDATE products SET active = 0, updated_at = ? WHERE active = 1 AND import_batch IS NOT NULL AND import_batch != ?").bind(now, importBatch).run();

  return json({ imported: incoming.length, importBatch });
}

function productPayload(body) {
  const name = String(body?.name ?? "").trim();
  const code = String(body?.code ?? "").trim();
  const price = Number(body?.price);
  const stock = body?.stock === "" || body?.stock === null || body?.stock === undefined ? null : Number(body.stock);
  const category = String(body?.category || "almacen").trim();
  if (!name) return { error: "Product name is required" };
  if (!Number.isFinite(price) || price < 0) return { error: "Price must be a valid non-negative number" };
  if (stock !== null && (!Number.isFinite(stock) || stock < 0)) return { error: "Stock must be a valid non-negative number" };
  return { name, code: code || null, price: Math.round(price), stock: stock === null ? null : Math.round(stock), category };
}

async function createProduct(request, env) {
  if (!env?.ADMIN_TOKEN) return json({ error: "Admin token not configured" }, { status: 503 });
  if (!adminAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
  if (!(await ensureSchema(env))) return json({ error: "Database not configured" }, { status: 503 });

  const body = await request.json();
  const payload = productPayload(body);
  if (payload.error) return json(payload, { status: 400 });
  const id = String(body?.id || `manual-${Date.now()}`);
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO products (id, name, code, cost, price, stock, category, active, image_key, import_batch, updated_at)
    VALUES (?, ?, ?, NULL, ?, ?, ?, 1, NULL, NULL, ?)`)
    .bind(id, payload.name, payload.code, payload.price, payload.stock, payload.category, now)
    .run();
  return json({ product: { id, ...payload, unit: "un" } }, { status: 201 });
}

async function updateProduct(request, env, id) {
  if (!env?.ADMIN_TOKEN) return json({ error: "Admin token not configured" }, { status: 503 });
  if (!adminAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
  if (!(await ensureSchema(env))) return json({ error: "Database not configured" }, { status: 503 });

  const payload = productPayload(await request.json());
  if (payload.error) return json(payload, { status: 400 });
  const result = await env.DB.prepare(`UPDATE products SET name = ?, code = ?, price = ?, stock = ?, category = ?, updated_at = ? WHERE id = ? AND active = 1`)
    .bind(payload.name, payload.code, payload.price, payload.stock, payload.category, new Date().toISOString(), id)
    .run();
  if (!result.meta?.changes) return json({ error: "Product not found" }, { status: 404 });
  return json({ product: { id, ...payload, unit: "un" } });
}

async function deactivateProduct(request, env, id) {
  if (!env?.ADMIN_TOKEN) return json({ error: "Admin token not configured" }, { status: 503 });
  if (!adminAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
  if (!(await ensureSchema(env))) return json({ error: "Database not configured" }, { status: 503 });

  const result = await env.DB.prepare("UPDATE products SET active = 0, updated_at = ? WHERE id = ? AND active = 1")
    .bind(new Date().toISOString(), id)
    .run();
  if (!result.meta?.changes) return json({ error: "Product not found" }, { status: 404 });
  return json({ id, active: false });
}

async function productImage(request, env, id) {
  if (!(await ensureSchema(env))) return json({ error: "Database not configured" }, { status: 503 });
  if (!env.IMAGES) return json({ error: "Image storage not configured" }, { status: 503 });

  const product = await env.DB.prepare("SELECT image_key FROM products WHERE id = ?").bind(id).first();
  const currentKey = product?.image_key ? String(product.image_key) : null;

  if (request.method === "GET") {
    if (!currentKey) return new Response("Not found", { status: 404 });
    const object = await env.IMAGES.get(currentKey);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("ETag", object.httpEtag);
    return new Response(object.body, { headers });
  }

  if (request.method === "POST") {
    if (!env?.ADMIN_TOKEN) return json({ error: "Admin token not configured" }, { status: 503 });
    if (!adminAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
    if (!product) return json({ error: "Product not found" }, { status: 404 });
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string" || !file.type.startsWith("image/")) {
      return json({ error: "An image file is required" }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) return json({ error: "Image must be smaller than 8 MB" }, { status: 413 });
    const nextKey = newProductImageKey(id);
    await env.IMAGES.put(nextKey, file.stream(), {
      httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
      customMetadata: { productId: id },
    });
    await env.DB.prepare("UPDATE products SET image_key = ?, updated_at = ? WHERE id = ?").bind(nextKey, new Date().toISOString(), id).run();
    if (currentKey && currentKey !== nextKey) await env.IMAGES.delete(currentKey);
    return json({ id, image: productImageUrl(id, nextKey) });
  }

  if (request.method === "DELETE") {
    if (!env?.ADMIN_TOKEN) return json({ error: "Admin token not configured" }, { status: 503 });
    if (!adminAuthorized(request, env)) return json({ error: "Unauthorized" }, { status: 401 });
    if (currentKey) await env.IMAGES.delete(currentKey);
    await env.DB.prepare("UPDATE products SET image_key = NULL, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
    return json({ id, image: null });
  }

  return new Response("Method not allowed", { status: 405 });
}

async function api(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/api/health") return json({ ok: true, database: Boolean(env?.DB), images: Boolean(env?.IMAGES) });
  if (url.pathname === "/api/products" && request.method === "GET") return listProducts(request, env);
  if (url.pathname === "/api/products" && request.method === "POST") return createProduct(request, env);
  if (url.pathname === "/api/products/import" && request.method === "POST") return importProducts(request, env);

  const imageMatch = url.pathname.match(/^\/api\/products\/([^/]+)\/image$/);
  if (imageMatch) return productImage(request, env, decodeURIComponent(imageMatch[1]));

  const productMatch = url.pathname.match(/^\/api\/products\/([^/]+)$/);
  if (productMatch && request.method === "PATCH") return updateProduct(request, env, decodeURIComponent(productMatch[1]));
  if (productMatch && request.method === "DELETE") return deactivateProduct(request, env, decodeURIComponent(productMatch[1]));

  return json({ error: "Not found" }, { status: 404 });
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await api(request, env);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 });
      }
    }

    const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const asset = assets[requestedPath] ?? (request.headers.get("accept")?.includes("text/html") ? assets["/index.html"] : undefined);
    if (!asset) return new Response("Not found", { status: 404 });

    return new Response(decodeBase64(asset.body), {
      headers: {
        "Content-Type": asset.type,
        "Cache-Control": requestedPath.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
};

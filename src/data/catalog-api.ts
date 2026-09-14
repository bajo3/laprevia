import type { Category, Product } from "./products";
import { categoryEmoji, DEFAULT_CATEGORIES, setCategoryState } from "./catalog-config";
import { normalizeCategory } from "./categorize";

/** Rows per request. Supabase/PostgREST caps a single response at 1000 rows,
 *  so the catalog is paged instead of fetched whole. */
export const PAGE_SIZE = 48;

export function normalizeRemoteProduct(value: Partial<Product>): Product {
  const category = normalizeCategory(value.category);
  return {
    id: String(value.id ?? ""),
    name: String(value.name ?? "Producto"),
    code: value.code ? String(value.code) : undefined,
    category,
    price: Number(value.price ?? 0),
    unit: value.unit ?? "un",
    // Derived from the section rather than read from the row: a product moved
    // to another section has to change its placeholder with it.
    emoji: categoryEmoji(category),
    image: value.image,
    stock: value.stock === undefined ? undefined : Number(value.stock),
  };
}

export type PhotoFilter = "all" | "missing" | "ready";

export type CatalogQuery = {
  query?: string;
  category?: string | null;
  photo?: PhotoFilter;
  offset?: number;
  limit?: number;
  /** Skips the edge cache. The panel sets it so a page reloaded right after an
   *  edit never shows the copy the CDN was still holding. */
  fresh?: boolean;
};

export type CatalogPage = {
  products: Product[];
  total: number;
};

/** Asks the server for one page. Filtering happens in Postgres, so the whole
 *  catalog is searchable even though only a page is ever sent to the browser. */
export async function fetchCatalogPage({
  query = "",
  category = null,
  photo = "all",
  offset = 0,
  limit = PAGE_SIZE,
  fresh = false,
}: CatalogQuery = {}): Promise<CatalogPage> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (query.trim()) params.set("q", query.trim());
  if (category) params.set("category", category);
  if (photo !== "all") params.set("photo", photo);
  if (fresh) params.set("fresh", "1");

  const response = await fetch(`/api/products?${params}`, { cache: "no-store" });
  if (!response.ok) throw new Error("El catálogo remoto todavía no está disponible.");
  const payload = (await response.json()) as { products?: Partial<Product>[]; total?: number };
  return {
    products: (payload.products ?? []).map(normalizeRemoteProduct),
    total: Number(payload.total ?? 0),
  };
}

/** Pages through the entire catalog. Only for the Excel import, which needs
 *  every existing row to preserve manually-assigned categories and photos.
 *  Supabase caps one response at 1000 rows, hence the loop. */
export async function fetchAllProducts(
  onProgress?: (loaded: number, total: number) => void,
): Promise<Product[]> {
  const BATCH = 1000;
  const all: Product[] = [];
  let offset = 0;
  let total = 0;

  do {
    const page = await fetchCatalogPage({ offset, limit: BATCH, fresh: true });
    total = page.total;
    all.push(...page.products);
    onProgress?.(all.length, total);
    if (page.products.length === 0) break;
    offset += page.products.length;
  } while (all.length < total);

  return all;
}

/* The bundled `catalogo-data.json` fallback was removed on purpose.
 *
 * It was a 3 MB copy of the catalog, served whenever the API hiccupped. Two
 * problems: it was regenerated only by a local script that stopped being used
 * once imports moved into the panel, so it drifted silently; and when it did
 * kick in, the shopper saw month-old prices with nothing telling them so. A
 * wholesale price that is quietly wrong is worse than no price — it turns into
 * an argument at the counter. The catalog now says plainly that it could not
 * load and offers WhatsApp, which is what the shop can actually honour. */

export type CategoryCounts = Record<string, number>;

/** How many active products each section holds, straight from Postgres. */
export async function fetchCategoryCounts(): Promise<CategoryCounts> {
  const response = await fetch("/api/products/categories", { cache: "no-store" });
  if (response.status === 401 || response.status === 403) throw new Error("Sesión no válida.");
  if (!response.ok) throw new Error("No se pudieron contar las secciones.");
  const payload = (await response.json()) as { counts?: CategoryCounts };
  return payload.counts ?? {};
}

export type CategoryMove = { id: string; category: string };

/** Files a batch of products into their sections. Writes only `category`, so
 *  prices, stock and photos are untouched. */
export async function moveProductsToCategories(moves: CategoryMove[], token: string | null) {
  const response = await fetch("/api/products/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ updates: moves }),
  });
  if (!response.ok) return { response, moved: 0, counts: {} as CategoryCounts };
  const payload = (await response.json()) as { moved?: number; counts?: CategoryCounts };
  return { response, moved: Number(payload.moved ?? 0), counts: payload.counts ?? {} };
}

/* -------------------------------------------------------------------------
 * Secciones
 *
 * The catalog used to carry its sections in the bundle, which meant adding one
 * was a deploy. They live in the database now and every one of these calls
 * ends at /api/categories, the only place allowed to write them.
 * ---------------------------------------------------------------------- */

type CategoriesResponse = { categories?: Category[]; editable?: boolean };

function authHeaders(token: string | null, body = false): Record<string, string> {
  return {
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Reads the sections into the shared store. `fresh` skips the edge cache and
 *  is what the panel uses, so an edit is never hidden behind a copy the CDN
 *  was still holding. */
export async function refreshCategories(fresh = false): Promise<Category[]> {
  try {
    const response = await fetch(`/api/categories${fresh ? "?fresh=1" : ""}`, { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudieron leer las secciones.");
    const payload = (await response.json()) as CategoriesResponse;
    const categories = (payload.categories ?? []).filter((category) => category?.slug);
    if (!categories.length) throw new Error("El servidor no devolvió ninguna sección.");
    setCategoryState({ categories, isLoaded: true, isEditable: Boolean(payload.editable) });
    return categories;
  } catch {
    // The sections the build shipped with, so the catalog still has a nav rail
    // and the panel still has a section dropdown. isEditable stays false: the
    // panel says the list could not be read rather than offering buttons that
    // would save nothing.
    setCategoryState({ categories: DEFAULT_CATEGORIES, isLoaded: true, isEditable: false });
    return DEFAULT_CATEGORIES;
  }
}

/** Every write answers with the list as it now stands, so the panel never has
 *  to guess what the server did with what it sent. */
async function writeCategories(method: string, body: unknown, token: string | null) {
  const response = await fetch("/api/categories", {
    method,
    headers: authHeaders(token, true),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw Object.assign(new Error(payload.error || "No se pudo guardar la sección."), { status: response.status });
  }
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  await refreshCategories(true);
  return payload;
}

export function createCategory(input: { label: string; emoji: string; color: string }, token: string | null) {
  return writeCategories("POST", input, token);
}

export function updateCategory(
  input: { slug: string; label?: string; emoji?: string; color?: string },
  token: string | null,
) {
  return writeCategories("PATCH", input, token);
}

export function reorderCategories(slugs: string[], token: string | null) {
  return writeCategories("PUT", { slugs }, token);
}

/** Deleting a section never deletes products: they are refiled into `moveTo`
 *  (the general drawer by default) before the section row goes. */
export async function deleteCategory(slug: string, moveTo: string, token: string | null) {
  const payload = await writeCategories("DELETE", { slug, moveTo }, token);
  return { moved: Number(payload.moved ?? 0), movedTo: String(payload.movedTo ?? moveTo) };
}

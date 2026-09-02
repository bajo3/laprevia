import type { Product } from "./products";
import { emojiByCategory } from "./catalog-config";
import { FALLBACK_CATEGORY, normalizeCategory } from "./categorize";

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
    emoji: emojiByCategory[category] ?? emojiByCategory[FALLBACK_CATEGORY],
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
}: CatalogQuery = {}): Promise<CatalogPage> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (query.trim()) params.set("q", query.trim());
  if (category) params.set("category", category);
  if (photo !== "all") params.set("photo", photo);

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
    const page = await fetchCatalogPage({ offset, limit: BATCH });
    total = page.total;
    all.push(...page.products);
    onProgress?.(all.length, total);
    if (page.products.length === 0) break;
    offset += page.products.length;
  } while (all.length < total);

  return all;
}

export async function fetchBundledCatalog() {
  const response = await fetch("/catalogo-data.json", { cache: "no-store" });
  if (!response.ok) throw new Error("El catálogo local todavía no está disponible.");
  const products = (await response.json()) as Partial<Product>[];
  return products.map(normalizeRemoteProduct);
}

export type CategoryCounts = Record<string, number>;

/** How many active products each section holds, straight from Postgres. */
export async function fetchCategoryCounts(): Promise<CategoryCounts> {
  const response = await fetch("/api/products/categories", { cache: "no-store" });
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

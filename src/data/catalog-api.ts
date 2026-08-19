import type { Product } from "./products";

const emojiByCategory: Record<string, string> = {
  cotillon: "🎉",
  snacks: "🍟",
  golosinas: "🍬",
  galletitas: "🍪",
  helados: "🍦",
  importados: "🌐",
  almacen: "🛒",
  regalos: "🎁",
};

/** Rows per request. Supabase/PostgREST caps a single response at 1000 rows,
 *  so the catalog is paged instead of fetched whole. */
export const PAGE_SIZE = 48;

export function normalizeRemoteProduct(value: Partial<Product>): Product {
  const category = value.category ?? "almacen";
  return {
    id: String(value.id ?? ""),
    name: String(value.name ?? "Producto"),
    code: value.code ? String(value.code) : undefined,
    category,
    price: Number(value.price ?? 0),
    unit: value.unit ?? "un",
    emoji: value.emoji ?? emojiByCategory[category] ?? "🛒",
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

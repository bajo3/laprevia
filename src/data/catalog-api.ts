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

export async function fetchCatalogProducts() {
  const response = await fetch("/api/products?limit=25000", { cache: "no-store" });
  if (!response.ok) throw new Error("El catálogo remoto todavía no está disponible.");
  const payload = (await response.json()) as { products?: Partial<Product>[] };
  return (payload.products ?? []).map(normalizeRemoteProduct);
}

export async function fetchBundledCatalog() {
  const response = await fetch("/catalogo-data.json", { cache: "no-store" });
  if (!response.ok) throw new Error("El catálogo local todavía no está disponible.");
  const products = (await response.json()) as Partial<Product>[];
  return products.map(normalizeRemoteProduct);
}

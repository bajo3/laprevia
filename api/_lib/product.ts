export type ProductPayload = {
  name: string;
  code: string | null;
  price: number;
  stock: number | null;
  category: string;
};

export type ProductPayloadError = { error: string };

export function parseProductPayload(body: unknown): ProductPayload | ProductPayloadError {
  const input = (body ?? {}) as Record<string, unknown>;
  const name = String(input.name ?? "").trim();
  const code = String(input.code ?? "").trim();
  const price = Number(input.price);
  const stock =
    input.stock === "" || input.stock === null || input.stock === undefined
      ? null
      : Number(input.stock);
  const category = String(input.category || "almacen").trim();

  if (!name) return { error: "Product name is required" };
  if (!Number.isFinite(price) || price < 0) return { error: "Price must be a valid non-negative number" };
  if (stock !== null && (!Number.isFinite(stock) || stock < 0)) {
    return { error: "Stock must be a valid non-negative number" };
  }

  return {
    name,
    code: code || null,
    price: Math.round(price),
    stock: stock === null ? null : Math.round(stock),
    category,
  };
}

export function isPayloadError(value: ProductPayload | ProductPayloadError): value is ProductPayloadError {
  return "error" in value;
}

export function productImageUrl(id: string, imageKey: string | null | undefined) {
  const base = `/api/products/${encodeURIComponent(id)}/image`;
  if (!imageKey) return undefined;
  const version = lastSegment(String(imageKey));
  return `${base}?v=${encodeURIComponent(version ?? "")}`;
}

/** Last "/"-separated segment, without relying on Array.prototype.at
 *  (needs es2022 lib, which Vercel's diagnostic pass for api/ didn't have). */
export function lastSegment(value: string): string | undefined {
  const parts = value.split("/");
  return parts[parts.length - 1];
}

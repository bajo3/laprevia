import { getSupabaseAdmin } from "../_lib/supabase";
import { isAdminAuthorized } from "../_lib/auth";
import { json } from "../_lib/json";
import { isPayloadError, parseProductPayload, productImageUrl } from "../_lib/product";

export const config = { runtime: "edge" };

function clamp(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : min, min), max);
}

async function listProducts(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ error: "Database not configured" }, { status: 503 });

  const url = new URL(request.url);
  const limit = clamp(url.searchParams.get("limit"), 1, 25000);
  const offset = clamp(url.searchParams.get("offset"), 0, 1000000);
  const query = (url.searchParams.get("q") ?? "").trim();
  const category = (url.searchParams.get("category") ?? "").trim();

  let builder = supabase
    .from("products")
    .select("id, name, code, price, stock, category, image_key", { count: "exact" })
    .eq("active", true)
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (query) {
    const like = `%${query}%`;
    builder = builder.or(`name.ilike.${like},id.ilike.${like},code.ilike.${like}`);
  }
  if (category) builder = builder.eq("category", category);

  const { data, count, error } = await builder;
  if (error) return json({ error: error.message }, { status: 500 });

  return json({
    total: count ?? 0,
    products: (data ?? []).map((product) => ({
      id: String(product.id),
      name: product.name,
      code: product.code || undefined,
      price: Number(product.price ?? 0),
      stock: product.stock === null ? undefined : Number(product.stock),
      category: product.category,
      unit: "un",
      image: productImageUrl(String(product.id), product.image_key as string | null),
    })),
  });
}

async function createProduct(request: Request) {
  if (!isAdminAuthorized(request)) return json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ error: "Database not configured" }, { status: 503 });

  const body = (await request.json()) as Record<string, unknown>;
  const payload = parseProductPayload(body);
  if (isPayloadError(payload)) return json(payload, { status: 400 });

  const id = String(body?.id || `manual-${Date.now()}`);
  const now = new Date().toISOString();
  const { error } = await supabase.from("products").insert({
    id,
    name: payload.name,
    code: payload.code,
    cost: null,
    price: payload.price,
    stock: payload.stock,
    category: payload.category,
    active: true,
    image_key: null,
    import_batch: null,
    updated_at: now,
  });
  if (error) return json({ error: error.message }, { status: 500 });

  return json({ product: { id, ...payload, unit: "un" } }, { status: 201 });
}

export default async function handler(request: Request) {
  try {
    if (request.method === "GET") return await listProducts(request);
    if (request.method === "POST") return await createProduct(request);
    return json({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 });
  }
}

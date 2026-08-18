import { getSupabaseAdmin } from "../_lib/supabase.js";
import { isAdminAuthorized } from "../_lib/auth.js";
import { json } from "../_lib/json.js";

export const config = { runtime: "edge" };

type IncomingProduct = {
  id: string;
  name: string;
  code?: string;
  cost?: number;
  price?: number;
  stock?: number;
  category?: string;
};

export default async function handler(request: Request) {
  try {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });
    if (!isAdminAuthorized(request)) return json({ error: "Unauthorized" }, { status: 401 });
    const supabase = getSupabaseAdmin();
    if (!supabase) return json({ error: "Database not configured" }, { status: 503 });

    const body = (await request.json()) as { products?: IncomingProduct[] };
    const incoming = Array.isArray(body?.products) ? body.products : [];
    if (!incoming.length) return json({ error: "No products received" }, { status: 400 });

    const importBatch = crypto.randomUUID();
    const now = new Date().toISOString();
    const rows = incoming.map((product) => ({
      id: String(product.id),
      name: String(product.name),
      code: product.code ? String(product.code) : null,
      cost: Number.isFinite(Number(product.cost)) ? Number(product.cost) : null,
      price: Number(product.price ?? 0),
      stock: Number.isFinite(Number(product.stock)) ? Number(product.stock) : null,
      category: String(product.category || "almacen"),
      active: true,
      updated_at: now,
      import_batch: importBatch,
    }));

    for (let index = 0; index < rows.length; index += 500) {
      const { error } = await supabase.from("products").upsert(rows.slice(index, index + 500), { onConflict: "id" });
      if (error) return json({ error: error.message }, { status: 500 });
    }

    const { error: deactivateError } = await supabase
      .from("products")
      .update({ active: false, updated_at: now })
      .eq("active", true)
      .not("import_batch", "is", null)
      .neq("import_batch", importBatch);
    if (deactivateError) return json({ error: deactivateError.message }, { status: 500 });

    return json({ imported: incoming.length, importBatch });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 });
  }
}

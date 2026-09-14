import { getSupabaseAdmin } from "../_lib/supabase.js";
import { isAdminAuthorized } from "../_lib/auth.js";
import { json } from "../_lib/json.js";
import { isPayloadError, parseProductPayload } from "../_lib/product.js";
import { loadCategorySlugs } from "../_lib/categories.js";

export const config = { runtime: "edge" };

function idFromUrl(request: Request) {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  return decodeURIComponent(segments[segments.length - 1] ?? "");
}

export default async function handler(request: Request) {
  try {
    if (!isAdminAuthorized(request)) return json({ error: "Unauthorized" }, { status: 401 });
    const supabase = getSupabaseAdmin();
    if (!supabase) return json({ error: "Database not configured" }, { status: 503 });
    const id = idFromUrl(request);

    if (request.method === "PATCH") {
      const payload = parseProductPayload(await request.json(), await loadCategorySlugs(supabase));
      if (isPayloadError(payload)) return json(payload, { status: 400 });

      const { data, error } = await supabase
        .from("products")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("active", true)
        .select("id")
        .maybeSingle();
      if (error) return json({ error: error.message }, { status: 500 });
      if (!data) return json({ error: "Product not found" }, { status: 404 });
      return json({ product: { id, ...payload, unit: "un" } });
    }

    if (request.method === "DELETE") {
      const { data, error } = await supabase
        .from("products")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("active", true)
        .select("id")
        .maybeSingle();
      if (error) return json({ error: error.message }, { status: 500 });
      if (!data) return json({ error: "Product not found" }, { status: 404 });
      return json({ id, active: false });
    }

    return json({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 });
  }
}

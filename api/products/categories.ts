import { getSupabaseAdmin } from "../_lib/supabase.js";
import { isAdminAuthorized } from "../_lib/auth.js";
import { json } from "../_lib/json.js";
import { CATEGORY_SLUGS, FALLBACK_CATEGORY, isKnownCategory } from "../_lib/categories.js";

export const config = { runtime: "edge" };

/** One id list per request has to fit in a PostgREST `in.(...)` filter, which
 *  travels in the URL. 200 ids stays well inside every proxy's URL limit. */
const MOVE_CHUNK = 200;
const MAX_UPDATES = 5000;

type Supabase = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** How many active products sit in each section. The panel shows this so the
 *  shop can see the general drawer emptying as articles get filed. */
async function countByCategory(supabase: Supabase) {
  const responses = await Promise.all(
    CATEGORY_SLUGS.map((slug) => {
      const builder = supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("active", true);
      // Rows written before "Almacén" became the general drawer still carry
      // the old slug, so they are counted with their replacement.
      return slug === FALLBACK_CATEGORY
        ? builder.in("category", [FALLBACK_CATEGORY, "almacen"])
        : builder.eq("category", slug);
    }),
  );

  const counts: Record<string, number> = {};
  responses.forEach((response, index) => {
    counts[CATEGORY_SLUGS[index]] = response.error ? 0 : response.count ?? 0;
  });
  return counts;
}

/** Moves a batch of products to another section. Only `category` is written,
 *  so a move never touches the price, the stock or the photo. */
async function moveProducts(request: Request, supabase: Supabase) {
  const body = (await request.json()) as { updates?: Array<{ id?: unknown; category?: unknown }> };
  const updates = Array.isArray(body?.updates) ? body.updates : [];
  if (!updates.length) return json({ error: "No hay productos para mover." }, { status: 400 });
  if (updates.length > MAX_UPDATES) {
    return json({ error: `Se pueden mover hasta ${MAX_UPDATES} productos por vez.` }, { status: 413 });
  }

  // Grouping by destination turns "move these 900 products" into one update
  // per section per chunk instead of 900 separate round trips.
  const byCategory = new Map<string, string[]>();
  for (const update of updates) {
    const id = String(update?.id ?? "").trim();
    const category = String(update?.category ?? "").trim().toLowerCase();
    if (!id) continue;
    if (!isKnownCategory(category)) {
      return json({ error: `La sección "${category}" no existe.` }, { status: 400 });
    }
    const bucket = byCategory.get(category);
    if (bucket) bucket.push(id);
    else byCategory.set(category, [id]);
  }

  const now = new Date().toISOString();
  let moved = 0;
  for (const [category, ids] of byCategory) {
    for (let index = 0; index < ids.length; index += MOVE_CHUNK) {
      const slice = ids.slice(index, index + MOVE_CHUNK);
      const { data, error } = await supabase
        .from("products")
        .update({ category, updated_at: now })
        .in("id", slice)
        .select("id");
      if (error) return json({ error: error.message }, { status: 500 });
      moved += (data ?? []).length;
    }
  }

  return json({ moved, counts: await countByCategory(supabase) });
}

export default async function handler(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return json({ error: "Database not configured" }, { status: 503 });

    if (request.method === "GET") {
      return json({ categories: CATEGORY_SLUGS, counts: await countByCategory(supabase) });
    }

    if (request.method === "POST") {
      if (!isAdminAuthorized(request)) return json({ error: "Unauthorized" }, { status: 401 });
      return await moveProducts(request, supabase);
    }

    return json({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 });
  }
}

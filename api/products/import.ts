import { getSupabaseAdmin } from "../_lib/supabase.js";
import { isAdminAuthorized } from "../_lib/auth.js";
import { json } from "../_lib/json.js";
import { normalizeCategory } from "../_lib/categories.js";

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

/** PostgREST caps one response at 1000 rows. */
const READ_PAGE = 1000;
const WRITE_CHUNK = 500;

type Supabase = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** Every section already assigned in the database, by product id.
 *
 *  The price list has no idea where the shop decided each article belongs, so
 *  the sections are read back here and re-applied on top of the import. That
 *  is what makes a correction made from the panel survive every future price
 *  list instead of being reset by the importer's keyword guess. */
async function readAssignedCategories(supabase: Supabase) {
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  const pages = Math.ceil(total / READ_PAGE);
  const responses = await Promise.all(
    Array.from({ length: pages }, (_unused, page) =>
      supabase
        .from("products")
        .select("id, category")
        .range(page * READ_PAGE, page * READ_PAGE + READ_PAGE - 1),
    ),
  );

  const assigned = new Map<string, string>();
  for (const response of responses) {
    if (response.error) throw new Error(response.error.message);
    for (const row of response.data ?? []) assigned.set(String(row.id), String(row.category));
  }
  return assigned;
}

export default async function handler(request: Request) {
  try {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });
    if (!isAdminAuthorized(request)) return json({ error: "Unauthorized" }, { status: 401 });
    const supabase = getSupabaseAdmin();
    if (!supabase) return json({ error: "Database not configured" }, { status: 503 });

    const body = (await request.json()) as { products?: IncomingProduct[] };
    const incoming = Array.isArray(body?.products) ? body.products : [];
    if (!incoming.length) return json({ error: "No products received" }, { status: 400 });

    const assigned = await readAssignedCategories(supabase);

    const importBatch = crypto.randomUUID();
    const now = new Date().toISOString();
    let keptCategories = 0;

    // image_key is deliberately absent from this object. PostgREST only writes
    // the columns present in the payload, so an upsert leaves the stored photo
    // untouched — uploading a new price list can never wipe the photo library.
    // Do not add image_key here.
    const rows = incoming.map((product) => {
      const id = String(product.id);
      const stored = assigned.get(id);
      if (stored) keptCategories += 1;
      return {
        id,
        name: String(product.name),
        code: product.code ? String(product.code) : null,
        cost: Number.isFinite(Number(product.cost)) ? Number(product.cost) : null,
        price: Number(product.price ?? 0),
        stock: Number.isFinite(Number(product.stock)) ? Number(product.stock) : null,
        category: stored ? normalizeCategory(stored) : normalizeCategory(product.category),
        active: true,
        updated_at: now,
        import_batch: importBatch,
      };
    });

    for (let index = 0; index < rows.length; index += WRITE_CHUNK) {
      const { error } = await supabase
        .from("products")
        .upsert(rows.slice(index, index + WRITE_CHUNK), { onConflict: "id" });
      if (error) return json({ error: error.message }, { status: 500 });
    }

    // Products that fell off the price list are hidden, not deleted: the row
    // and its image_key stay, so the photo comes back if the article returns.
    const { error: deactivateError } = await supabase
      .from("products")
      .update({ active: false, updated_at: now })
      .eq("active", true)
      .not("import_batch", "is", null)
      .neq("import_batch", importBatch);
    if (deactivateError) return json({ error: deactivateError.message }, { status: 500 });

    return json({ imported: incoming.length, keptCategories, importBatch });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 });
  }
}

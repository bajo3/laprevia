import { getSupabaseAdmin } from "../_lib/supabase.js";
import { isAdminAuthorized } from "../_lib/auth.js";
import { json } from "../_lib/json.js";
import { isPayloadError, parseProductPayload, productImageUrl } from "../_lib/product.js";
import { FALLBACK_CATEGORY, loadCategorySlugs, normalizeCategory } from "../_lib/categories.js";
import { searchFilterGroups } from "../_lib/search.js";

export const config = { runtime: "edge" };

/** The public catalog changes when a price list is imported, not by the
 *  minute, so there is no reason for every visitor to wake the function. One
 *  minute of edge caching plus a day of stale-while-revalidate means the first
 *  visitor after an import pays the round trip and nobody else does — which is
 *  what removes the 3,3 s cold start the shop was seeing on a quiet morning.
 *
 *  Only responses that anyone may see are cached. The dashboard's own views
 *  (the photo filter) stay uncached so an edit is visible immediately. */
const PUBLIC_CACHE = "public, s-maxage=60, stale-while-revalidate=86400";

/** How many ids one request may ask for by name. The public catalog keeps a
 *  shopper's favourites on their device and reads them back with `?id=…&id=…`;
 *  it caps its own list at 200, and this leaves headroom without letting one
 *  request carry an unbounded filter. */
const MAX_IDS = 300;

/** Every spelling a scanner may give the same barcode.
 *
 *  A UPC-A code is twelve digits and the same code read as EAN-13 carries a
 *  zero in front; which one a reader sends depends on how it is configured,
 *  and which one the price list stored depends on who typed it. */
function codeVariants(code: string): string[] {
  const variants = [code];
  if (/^\d{12}$/.test(code)) variants.push(`0${code}`);
  if (/^0\d{12}$/.test(code)) variants.push(code.slice(1));
  return variants;
}

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
    // Section first, name second. Ordering by name alone opened the catalog on
    // "3 D PEPSICO X 143 G" and "40 HAMBURG CHEF BURGUER C PAN", because the
    // price list names start with digits. Grouping by section is what matters
    // here; which section leads follows from the slugs sorting alphabetically,
    // and the shop sets the order it actually cares about — the one on the nav
    // rail — from the panel.
    .order("category", { ascending: true })
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  // One filter per word, ANDed by PostgREST, so word order does not matter and
  // accents match both ways. See _lib/search.ts for why this is a regex and
  // not a LIKE pattern.
  for (const group of searchFilterGroups(query)) {
    builder = builder.or(group);
  }
  // Rows written before a section was renamed still carry the old slug, so a
  // request for the general drawer has to match both names.
  if (category === FALLBACK_CATEGORY) builder = builder.in("category", [FALLBACK_CATEGORY, "almacen"]);
  else if (category) builder = builder.eq("category", category);

  // The price checker: the exact code, not a substring. Scanning "7645" has to
  // return that article and not every barcode with those four digits in it.
  const code = (url.searchParams.get("code") ?? "").trim();
  if (code) builder = builder.in("code", codeVariants(code));

  // A specific set of products, for the shopper's favourites. Repeated `id`
  // parameters rather than one comma-separated value: ids typed by hand in the
  // panel can contain anything, a comma included.
  if (url.searchParams.has("id")) {
    const ids = url.searchParams
      .getAll("id")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, MAX_IDS);
    // Asking for "these ids" with none left must not fall through to "all of
    // them" — that would answer an empty favourites list with the catalog.
    if (!ids.length) return json({ total: 0, products: [] });
    builder = builder.in("id", ids);
  }

  // The dashboard's core workflow is "show me what still needs a photo".
  // Filtering that in Postgres keeps it accurate across the whole catalog
  // rather than only within the page already sent to the browser.
  const photo = (url.searchParams.get("photo") ?? "").trim();
  if (photo === "missing") builder = builder.is("image_key", null);
  if (photo === "ready") builder = builder.not("image_key", "is", null);

  // The section list is a dozen rows and the catalog page is up to a thousand,
  // so reading both at once costs nothing measurable and keeps a product whose
  // section was deleted from being served under a name no button can reach.
  const [{ data, count, error }, known] = await Promise.all([builder, loadCategorySlugs(supabase)]);
  if (error) return json({ error: error.message }, { status: 500 });

  // The dashboard looks at its own work, so it must never read a copy that is
  // a minute behind the edit just made: the photo filter and anything asking
  // for `fresh` skip the cache entirely.
  const wantsFresh = url.searchParams.get("fresh") === "1";
  const cacheControl = photo || wantsFresh ? "no-store" : PUBLIC_CACHE;

  return json({
    total: count ?? 0,
    products: (data ?? []).map((product) => ({
      id: String(product.id),
      name: product.name,
      code: product.code || undefined,
      price: Number(product.price ?? 0),
      stock: product.stock === null ? undefined : Number(product.stock),
      category: normalizeCategory(product.category, known),
      unit: "un",
      image: productImageUrl(String(product.id), product.image_key as string | null),
    })),
  }, { headers: { "Cache-Control": cacheControl } });
}

async function createProduct(request: Request) {
  if (!isAdminAuthorized(request)) return json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return json({ error: "Database not configured" }, { status: 503 });

  const body = (await request.json()) as Record<string, unknown>;
  const payload = parseProductPayload(body, await loadCategorySlugs(supabase));
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

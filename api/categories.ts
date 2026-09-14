import { getSupabaseAdmin } from "./_lib/supabase.js";
import { isAdminAuthorized } from "./_lib/auth.js";
import { json } from "./_lib/json.js";
import {
  DEFAULT_CATEGORIES,
  FALLBACK_CATEGORY,
  loadCategories,
  slugify,
  type CategoryRow,
} from "./_lib/categories.js";

export const config = { runtime: "edge" };

/** Same contract as the catalog itself: sections change when the shop edits
 *  them, not by the minute, so the public list is cached at the edge. The
 *  panel asks with ?fresh=1 and always sees its own writes. */
const PUBLIC_CACHE = "public, s-maxage=60, stale-while-revalidate=86400";

/** A nav rail nobody can read is not a feature. This sits far above anything
 *  the shop would plausibly want and only exists so nothing can run away. */
const MAX_CATEGORIES = 40;
const MAX_LABEL = 30;
/** An emoji is one glyph but several code units: the candle is three. */
const MAX_EMOJI = 16;

/** Either one of the palette variables or a plain hex. Anything else is
 *  refused: this string is written straight into an inline background-color,
 *  so free text is both a way to break the design and a way to smuggle CSS
 *  into the page. */
const COLOR_PATTERN = /^(var\(--color-[a-z-]{1,24}\)|#[0-9a-fA-F]{6})$/;

type Supabase = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

function badRequest(message: string) {
  return json({ error: message }, { status: 400 });
}

/** Writing sections requires the table. Without this check, a deploy that
 *  landed before 0004_categories_table.sql would answer 200 to every edit
 *  while the built-in list stayed exactly as it was. */
function tableMissing() {
  return json(
    { error: "Todavía no existe la tabla de secciones en la base. Corré db/migrations/0004_categories_table.sql." },
    { status: 503 },
  );
}

function readLabel(value: unknown): string | null {
  const label = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!label || label.length > MAX_LABEL) return null;
  return label;
}

function readEmoji(value: unknown, fallback: string): string {
  const emoji = String(value ?? "").trim();
  if (!emoji || emoji.length > MAX_EMOJI) return fallback;
  return emoji;
}

function readColor(value: unknown, fallback: string): string {
  const color = String(value ?? "").trim();
  return COLOR_PATTERN.test(color) ? color : fallback;
}

/** Free slug derived from the label. The suffix only appears on a collision,
 *  so "Bazar" stays "bazar" and a second "Bazar" becomes "bazar-2". */
function uniqueSlug(label: string, taken: Set<string>): string | null {
  const base = slugify(label);
  if (!base) return null;
  if (!taken.has(base)) return base;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${base}-${suffix}`.slice(0, 40);
    if (!taken.has(candidate)) return candidate;
  }
  return null;
}

async function listCategories(request: Request, supabase: Supabase) {
  const { categories, fromTable } = await loadCategories(supabase);
  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
  return json(
    { categories, editable: fromTable },
    { headers: { "Cache-Control": fresh ? "no-store" : PUBLIC_CACHE } },
  );
}

async function createCategory(request: Request, supabase: Supabase) {
  const { categories, fromTable } = await loadCategories(supabase);
  if (!fromTable) return tableMissing();
  if (categories.length >= MAX_CATEGORIES) {
    return badRequest(`No se pueden tener más de ${MAX_CATEGORIES} secciones.`);
  }

  const body = (await request.json()) as Record<string, unknown>;
  const label = readLabel(body?.label);
  if (!label) return badRequest(`Poné un nombre de hasta ${MAX_LABEL} caracteres.`);

  const taken = new Set(categories.map((category) => category.slug));
  const slug = uniqueSlug(label, taken);
  if (!slug) return badRequest("Ese nombre no sirve para una sección. Probá con letras y números.");

  // Sits just after the last real section: "Varios" stays at the end.
  const highest = categories
    .filter((category) => !category.protected)
    .reduce((max, category) => Math.max(max, category.position), 0);

  const row: CategoryRow = {
    slug,
    label,
    emoji: readEmoji(body?.emoji, "🏷️"),
    color: readColor(body?.color, "var(--color-ink)"),
    position: highest + 1,
    protected: false,
  };

  const { error } = await supabase.from("categories").insert(row);
  if (error) return json({ error: error.message }, { status: 500 });

  return json({ category: row }, { status: 201 });
}

async function updateCategory(request: Request, supabase: Supabase) {
  const { categories, fromTable } = await loadCategories(supabase);
  if (!fromTable) return tableMissing();

  const body = (await request.json()) as Record<string, unknown>;
  const slug = String(body?.slug ?? "").trim().toLowerCase();
  const current = categories.find((category) => category.slug === slug);
  if (!current) return json({ error: "Esa sección no existe." }, { status: 404 });

  // The slug is deliberately not editable: it is the value stored on every
  // product row. Renaming changes the label the shopper reads and nothing
  // else, so it costs one write instead of fifteen thousand.
  const label = body?.label === undefined ? current.label : readLabel(body.label);
  if (!label) return badRequest(`Poné un nombre de hasta ${MAX_LABEL} caracteres.`);

  const update = {
    label,
    emoji: body?.emoji === undefined ? current.emoji : readEmoji(body.emoji, current.emoji),
    color: body?.color === undefined ? current.color : readColor(body.color, current.color),
  };

  const { error } = await supabase.from("categories").update(update).eq("slug", slug);
  if (error) return json({ error: error.message }, { status: 500 });

  return json({ category: { ...current, ...update } });
}

/** Rewrites the display order from a list of slugs. One request instead of a
 *  PATCH per arrow tap, so a half-applied order cannot survive a connection
 *  lost between two of them. */
async function reorderCategories(request: Request, supabase: Supabase) {
  const { categories, fromTable } = await loadCategories(supabase);
  if (!fromTable) return tableMissing();

  const body = (await request.json()) as { slugs?: unknown };
  const slugs = Array.isArray(body?.slugs) ? body.slugs.map((value) => String(value)) : [];
  const known = new Map(categories.map((category) => [category.slug, category]));
  if (!slugs.length || slugs.some((slug) => !known.has(slug))) {
    return badRequest("El orden recibido no coincide con las secciones que existen.");
  }

  let position = 0;
  for (const slug of slugs) {
    // "Varios" keeps its place at the end whatever the panel sends.
    const next = known.get(slug)?.protected ? 999 : (position += 1);
    const { error } = await supabase.from("categories").update({ position: next }).eq("slug", slug);
    if (error) return json({ error: error.message }, { status: 500 });
  }

  return await listCategories(request, supabase);
}

/** Deletes a section and refiles its products.
 *
 *  The products move first and the section row goes second: if the move fails,
 *  the section is still there, which is recoverable. The other order would
 *  leave rows pointing at a section that no longer exists. */
async function deleteCategory(request: Request, supabase: Supabase) {
  const { categories, fromTable } = await loadCategories(supabase);
  if (!fromTable) return tableMissing();

  const body = (await request.json()) as Record<string, unknown>;
  const slug = String(body?.slug ?? "").trim().toLowerCase();
  const current = categories.find((category) => category.slug === slug);
  if (!current) return json({ error: "Esa sección no existe." }, { status: 404 });
  if (current.protected) {
    return badRequest(`"${current.label}" es el cajón general del catálogo y no se puede eliminar.`);
  }

  const requested = String(body?.moveTo ?? "").trim().toLowerCase();
  const destination = categories.find((category) => category.slug === requested && category.slug !== slug)
    ?? categories.find((category) => category.slug === FALLBACK_CATEGORY);
  if (!destination) return badRequest("No hay ninguna sección a la que mover estos productos.");

  const now = new Date().toISOString();
  const { data: moved, error: moveError } = await supabase
    .from("products")
    .update({ category: destination.slug, updated_at: now })
    .eq("category", slug)
    .select("id");
  if (moveError) return json({ error: moveError.message }, { status: 500 });

  const { error } = await supabase.from("categories").delete().eq("slug", slug);
  if (error) return json({ error: error.message }, { status: 500 });

  return json({ deleted: slug, movedTo: destination.slug, moved: (moved ?? []).length });
}

export default async function handler(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      // The catalog can still render its sections without a database; only
      // editing them needs one.
      if (request.method === "GET") {
        return json({ categories: DEFAULT_CATEGORIES, editable: false }, { headers: { "Cache-Control": PUBLIC_CACHE } });
      }
      return json({ error: "Database not configured" }, { status: 503 });
    }

    if (request.method === "GET") return await listCategories(request, supabase);

    if (!isAdminAuthorized(request)) return json({ error: "Unauthorized" }, { status: 401 });

    if (request.method === "POST") return await createCategory(request, supabase);
    if (request.method === "PATCH") return await updateCategory(request, supabase);
    if (request.method === "PUT") return await reorderCategories(request, supabase);
    if (request.method === "DELETE") return await deleteCategory(request, supabase);

    return json({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 });
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";

export type CategoryRow = {
  slug: string;
  label: string;
  emoji: string;
  color: string;
  position: number;
  protected: boolean;
};

/** Where a product lands when it has no section yet. Also the destination for
 *  the products of a section that gets deleted, which is why the row is
 *  protected in the database. */
export const FALLBACK_CATEGORY = "varios";

/** Retired slugs mapped to their replacement, so rows written before a rename
 *  still resolve to a section the catalog can show. This is for slugs retired
 *  in code, before sections lived in the database; deleting a section from the
 *  panel refiles its products instead of leaving them pointing at nothing. */
const LEGACY_SLUGS: Record<string, string> = {
  almacen: FALLBACK_CATEGORY,
};

/** The eleven sections that used to be hard-coded here. Still the answer when
 *  the `categories` table is missing — a deploy that lands before the
 *  migration runs keeps serving the catalog exactly as it did before, instead
 *  of showing a shop with no sections. */
export const DEFAULT_CATEGORIES: CategoryRow[] = [
  { slug: "cotillon", label: "Cotillón", emoji: "🎉", color: "var(--color-pink)", position: 1, protected: false },
  { slug: "reposteria", label: "Repostería", emoji: "🧁", color: "var(--color-teal-dark)", position: 2, protected: false },
  { slug: "descartables", label: "Descartables", emoji: "🥤", color: "var(--color-blue)", position: 3, protected: false },
  { slug: "golosinas", label: "Golosinas", emoji: "🍬", color: "var(--color-violet)", position: 4, protected: false },
  { slug: "snacks", label: "Snacks", emoji: "🍟", color: "var(--color-orange)", position: 5, protected: false },
  { slug: "galletitas", label: "Galletitas", emoji: "🍪", color: "var(--color-orange)", position: 6, protected: false },
  { slug: "helados", label: "Helados", emoji: "🍦", color: "var(--color-teal)", position: 7, protected: false },
  { slug: "sahumerios", label: "Sahumerios", emoji: "🕯️", color: "var(--color-violet-dark)", position: 8, protected: false },
  { slug: "importados", label: "Importados", emoji: "🌐", color: "var(--color-yellow)", position: 9, protected: false },
  { slug: "regalos", label: "Regalos", emoji: "🎁", color: "var(--color-pink-dark)", position: 10, protected: false },
  { slug: "varios", label: "Varios", emoji: "🛒", color: "var(--color-ink)", position: 999, protected: true },
];

type Supabase = SupabaseClient;

/** Reads the sections, in display order.
 *
 *  `fromTable` says whether the answer came from the database or from the
 *  built-in list. A caller that is about to write has to refuse when it is
 *  false: writing sections into a table that does not exist yet would report
 *  success and change nothing. */
export async function loadCategories(
  supabase: Supabase,
): Promise<{ categories: CategoryRow[]; fromTable: boolean }> {
  const { data, error } = await supabase
    .from("categories")
    .select("slug, label, emoji, color, position, protected")
    .order("position", { ascending: true })
    .order("label", { ascending: true });

  if (error || !data?.length) return { categories: DEFAULT_CATEGORIES, fromTable: false };

  return {
    categories: data.map((row) => ({
      slug: String(row.slug),
      label: String(row.label ?? row.slug),
      emoji: String(row.emoji ?? "🏷️"),
      color: String(row.color ?? "var(--color-ink)"),
      position: Number(row.position ?? 0),
      protected: Boolean(row.protected),
    })),
    fromTable: true,
  };
}

/** Just the slugs, for the routes that only need to validate. */
export async function loadCategorySlugs(supabase: Supabase): Promise<Set<string>> {
  const { categories } = await loadCategories(supabase);
  return new Set(categories.map((category) => category.slug));
}

/** Never throws: a retired slug is remapped and an unknown one collapses to
 *  the fallback rather than naming a section no button on the catalog can
 *  reach. */
export function normalizeCategory(value: unknown, known: Set<string>): string {
  const slug = String(value ?? "").trim().toLowerCase();
  if (!slug) return FALLBACK_CATEGORY;
  if (known.has(slug)) return slug;
  const legacy = LEGACY_SLUGS[slug];
  if (legacy && known.has(legacy)) return legacy;
  return FALLBACK_CATEGORY;
}

/** Turns what the shop typed into a slug: lowercase, no accents, no spaces.
 *  The slug is the value stored on every product row, so it is generated once
 *  when the section is created and never changes again — renaming a section
 *  rewrites one row, not fifteen thousand. */
export function slugify(label: string): string {
  return String(label ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

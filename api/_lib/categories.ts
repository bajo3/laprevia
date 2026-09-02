/** The sections a product can belong to. Kept in step with
 *  src/data/catalog-config.ts by hand: api/ compiles on its own tsconfig and
 *  cannot import from src/. Adding a section means editing both files. */
export const CATEGORY_SLUGS = [
  "cotillon",
  "reposteria",
  "descartables",
  "golosinas",
  "snacks",
  "galletitas",
  "helados",
  "sahumerios",
  "importados",
  "regalos",
  "varios",
] as const;

/** Where a product lands when it has no section yet. */
export const FALLBACK_CATEGORY = "varios";

/** Retired slugs mapped to their replacement, so rows written before a rename
 *  still resolve to a section the catalog can show. */
const LEGACY_SLUGS: Record<string, string> = {
  almacen: FALLBACK_CATEGORY,
};

const KNOWN = new Set<string>(CATEGORY_SLUGS);

export function isKnownCategory(value: string) {
  return KNOWN.has(value);
}

/** Never throws: an unknown or retired slug collapses to the fallback rather
 *  than creating a section no button on the catalog can reach. */
export function normalizeCategory(value: unknown): string {
  const slug = String(value ?? "").trim().toLowerCase();
  if (!slug) return FALLBACK_CATEGORY;
  if (LEGACY_SLUGS[slug]) return LEGACY_SLUGS[slug];
  return KNOWN.has(slug) ? slug : FALLBACK_CATEGORY;
}

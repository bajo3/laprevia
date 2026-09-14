import { useSyncExternalStore } from "react";
import type { Category } from "./products";

/** Where a product lands when it has no section yet, and the destination for
 *  the products of a section that gets deleted. The server protects this row,
 *  so the panel never lets it be removed. */
export const FALLBACK_SLUG = "varios";

/** The eleven sections the catalog shipped with, before they moved into the
 *  database and became editable from the panel.
 *
 *  This is not the source of truth any more — it is what the page draws while
 *  `/api/categories` is still in flight, and what it falls back to if that
 *  request never answers. Better a catalog with the sections it had yesterday
 *  than a catalog with no sections at all. */
export const DEFAULT_CATEGORIES: Category[] = [
  { slug: "cotillon", label: "Cotillón", emoji: "🎉", color: "var(--color-pink)" },
  { slug: "reposteria", label: "Repostería", emoji: "🧁", color: "var(--color-teal-dark)" },
  { slug: "descartables", label: "Descartables", emoji: "🥤", color: "var(--color-blue)" },
  { slug: "golosinas", label: "Golosinas", emoji: "🍬", color: "var(--color-violet)" },
  { slug: "snacks", label: "Snacks", emoji: "🍟", color: "var(--color-orange)" },
  { slug: "galletitas", label: "Galletitas", emoji: "🍪", color: "var(--color-orange)" },
  { slug: "helados", label: "Helados", emoji: "🍦", color: "var(--color-teal)" },
  { slug: "sahumerios", label: "Sahumerios", emoji: "🕯️", color: "var(--color-violet-dark)" },
  { slug: "importados", label: "Importados", emoji: "🌐", color: "var(--color-yellow)" },
  { slug: "regalos", label: "Regalos", emoji: "🎁", color: "var(--color-pink-dark)" },
  { slug: FALLBACK_SLUG, label: "Varios", emoji: "🛒", color: "var(--color-ink)", protected: true },
];

/** The palette a new section can be painted with. Free colours are refused by
 *  the server too: this string ends up in an inline `background-color`, and a
 *  catalog where every section is a different shade of whatever was handy
 *  stops looking like one shop. */
export const CATEGORY_COLORS: Array<{ value: string; label: string }> = [
  { value: "var(--color-pink)", label: "Rosa" },
  { value: "var(--color-pink-dark)", label: "Rosa oscuro" },
  { value: "var(--color-violet)", label: "Violeta" },
  { value: "var(--color-violet-dark)", label: "Violeta oscuro" },
  { value: "var(--color-blue)", label: "Azul" },
  { value: "var(--color-teal)", label: "Verde agua" },
  { value: "var(--color-teal-dark)", label: "Verde oscuro" },
  { value: "var(--color-yellow)", label: "Amarillo" },
  { value: "var(--color-orange)", label: "Naranja" },
  { value: "var(--color-ink)", label: "Tinta" },
];

export type CategoryState = {
  categories: Category[];
  /** False until `/api/categories` answers. The nav waits on this rather than
   *  flashing the built-in list and then rewriting it under the shopper. */
  isLoaded: boolean;
  /** False when the server is serving the built-in list because the database
   *  or its `categories` table is not there. The panel says so instead of
   *  offering edit buttons that would fail on save. */
  isEditable: boolean;
};

let state: CategoryState = { categories: DEFAULT_CATEGORIES, isLoaded: false, isEditable: false };

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Sections live in one place for the whole tab: the public catalog, the panel
 *  and the plain functions that resolve a slug all read the same snapshot, so
 *  a section renamed in the panel cannot linger under its old name anywhere
 *  else on the page. */
export function setCategoryState(next: Partial<CategoryState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function getCategories(): Category[] {
  return state.categories;
}

export function areCategoriesLoaded(): boolean {
  return state.isLoaded;
}

export function useCategories(): CategoryState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function findCategory(slug: string): Category | undefined {
  return state.categories.find((category) => category.slug === slug);
}

export function categoryLabel(slug: string) {
  return findCategory(slug)?.label ?? slug;
}

/** The placeholder drawn for a product with no photo. Derived from the section
 *  rather than stored on the product, so moving an article to another section
 *  changes its placeholder with it. */
export function categoryEmoji(slug: string) {
  return findCategory(slug)?.emoji ?? findCategory(FALLBACK_SLUG)?.emoji ?? "🛒";
}

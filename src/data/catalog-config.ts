import type { Category } from "./products";

/** The order here is the order of the buttons on the public catalog and of the
 *  section list in the panel. "Varios" stays last on purpose: it is the drawer
 *  for what has not been filed yet, not a real section of the business. */
export const categories: Category[] = [
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
  { slug: "varios", label: "Varios", emoji: "🛒", color: "var(--color-ink)" },
];

export const emojiByCategory: Record<string, string> = Object.fromEntries(
  categories.map((category) => [category.slug, category.emoji]),
);

export function categoryLabel(slug: string) {
  return categories.find((category) => category.slug === slug)?.label ?? slug;
}

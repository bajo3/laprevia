import type { Product, Category } from "../data/products";
import ProductCard from "./ProductCard";

// Playful tilt applied only from the sm breakpoint up (literal class strings
// so Tailwind's scanner emits them) — keeps the tight 2-col mobile grid clean.
const tilts = [
  "sm:rotate-[-2deg]",
  "sm:rotate-[1.5deg]",
  "sm:rotate-[-1deg]",
  "sm:rotate-[2deg]",
  "sm:rotate-[-1.5deg]",
  "sm:rotate-[1deg]",
];

type ProductGridProps = {
  products: Product[];
  categories: Category[];
  quantities: Record<string, number>;
  onChangeQuantity: (product: Product, delta: number) => void;
};

export default function ProductGrid({
  products,
  categories,
  quantities,
  onChangeQuantity,
}: ProductGridProps) {
  const byCategory = (slug: string) => categories.find((c) => c.slug === slug);

  return (
    <section id="catalogo" className="mx-auto max-w-6xl px-5 pb-20">
      {products.length === 0 ? (
        <p className="py-16 text-center font-display text-2xl text-ink/50">
          Todavía no hay productos en esta categoría 👀
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
          {products.map((p, i) => (
            <ProductCard
              key={p.id}
              product={p}
              category={byCategory(p.category)}
              tiltClass={tilts[i % tilts.length]}
              quantity={quantities[p.id] ?? 0}
              onChangeQuantity={onChangeQuantity}
            />
          ))}
        </div>
      )}
    </section>
  );
}

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
  hasMore?: boolean;
  onLoadMore?: () => void;
  totalCount?: number;
};

export default function ProductGrid({
  products,
  categories,
  quantities,
  onChangeQuantity,
  hasMore = false,
  onLoadMore,
  totalCount,
}: ProductGridProps) {
  const byCategory = (slug: string) => categories.find((c) => c.slug === slug);

  return (
    <section id="catalogo" className="mx-auto max-w-6xl px-5 pb-20">
      {products.length === 0 ? (
        <p className="py-16 text-center font-display text-2xl text-ink/50">
          Todavía no hay productos en esta categoría 👀
        </p>
      ) : (
        // 3 columns only from md: at the sm breakpoint a 3-up grid leaves ~144px
        // per card, which cuts almost every catalog name.
        <div className="grid grid-cols-2 gap-3.5 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
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
      {hasMore && onLoadMore && (
        <div className="mt-10 text-center">
          <p className="mb-3 text-sm font-bold text-ink/45">Mostrando {products.length.toLocaleString("es-AR")} de {(totalCount ?? products.length).toLocaleString("es-AR")}</p>
          <button type="button" onClick={onLoadMore} className="rounded-full border-[3px] border-ink bg-yellow px-6 py-3 font-extrabold shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5">
            Mostrar más productos
          </button>
        </div>
      )}
    </section>
  );
}

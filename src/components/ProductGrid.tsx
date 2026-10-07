import type { ReactNode } from "react";
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

const GRID_CLASSES = "grid grid-cols-2 gap-3.5 sm:gap-6 md:grid-cols-3 lg:grid-cols-4";

type ProductGridProps = {
  products: Product[];
  categories: Category[];
  quantities: Record<string, number>;
  onChangeQuantity: (product: Product, delta: number) => void;
  favoriteIds: ReadonlySet<string>;
  onToggleFavorite: (product: Product) => void;
  onZoom: (product: Product) => void;
  /** Replaces the "nothing matched your search" message when the list is
   *  empty for a different reason, such as no favourites marked yet. */
  emptyState?: ReactNode;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  totalCount?: number;
};

function ProductSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl border-[3px] border-ink/25 bg-white p-3 sm:p-5">
      {/* Matches ProductCard's real image box (aspect-square) so the page does
          not jump in height once the photo replaces the skeleton. */}
      <div className="aspect-square w-full rounded-2xl bg-cream-dark" />
      <div className="mt-3 h-2.5 w-1/2 rounded-full bg-cream-dark" />
      <div className="mt-2 h-3.5 w-full rounded-full bg-cream-dark" />
      <div className="mt-1.5 h-3.5 w-4/5 rounded-full bg-cream-dark" />
      <div className="mt-3 h-5 w-2/3 rounded-full bg-cream-dark" />
      <div className="mt-4 h-11 w-full rounded-full bg-cream-dark" />
    </div>
  );
}

export default function ProductGrid({
  products,
  categories,
  quantities,
  onChangeQuantity,
  favoriteIds,
  onToggleFavorite,
  onZoom,
  emptyState,
  isLoading = false,
  isLoadingMore = false,
  hasMore = false,
  onLoadMore,
  totalCount,
}: ProductGridProps) {
  const byCategory = (slug: string) => categories.find((c) => c.slug === slug);

  if (isLoading) {
    return (
      <section id="catalogo" className="mx-auto max-w-6xl px-5 pb-20">
        <div className={GRID_CLASSES} aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <ProductSkeleton key={index} />
          ))}
        </div>
        <p className="sr-only" role="status">
          Cargando productos…
        </p>
      </section>
    );
  }

  return (
    <section id="catalogo" className="mx-auto max-w-6xl px-5 pb-20">
      {products.length === 0 && emptyState ? (
        emptyState
      ) : products.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-5xl" aria-hidden="true">
            🔍
          </p>
          <p className="font-display mt-4 text-2xl text-ink/70">No encontramos nada con eso</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink/50">
            Probá con otra palabra, revisá la ortografía o mirá otra categoría.
          </p>
        </div>
      ) : (
        // 3 columns only from md: at the sm breakpoint a 3-up grid leaves ~144px
        // per card, which cuts almost every catalog name.
        <div className={GRID_CLASSES}>
          {products.map((p, i) => (
            <ProductCard
              key={p.id}
              product={p}
              category={byCategory(p.category)}
              tiltClass={tilts[i % tilts.length]}
              quantity={quantities[p.id] ?? 0}
              onChangeQuantity={onChangeQuantity}
              isFavorite={favoriteIds.has(p.id)}
              onToggleFavorite={onToggleFavorite}
              onZoom={onZoom}
            />
          ))}
        </div>
      )}

      {hasMore && onLoadMore && (
        <div className="mt-10 text-center">
          <p className="mb-3 text-sm font-bold text-ink/45">
            Mostrando {products.length.toLocaleString("es-AR")} de{" "}
            {(totalCount ?? products.length).toLocaleString("es-AR")}
          </p>
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="rounded-full border-[3px] border-ink bg-yellow px-6 py-3 font-extrabold shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
          >
            {isLoadingMore ? "Cargando…" : "Mostrar más productos"}
          </button>
        </div>
      )}
    </section>
  );
}

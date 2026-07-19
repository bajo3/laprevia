import type { Product, Category } from "../data/products";
import ProductCard from "./ProductCard";

const rotations = [-2, 1.5, -1, 2, -1.5, 1];

export default function ProductGrid({ products, categories }: { products: Product[]; categories: Category[] }) {
  const byCategory = (slug: string) => categories.find((c) => c.slug === slug);

  return (
    <section id="catalogo" className="mx-auto max-w-6xl px-5 pb-20">
      {products.length === 0 ? (
        <p className="py-16 text-center font-display text-2xl text-ink/50">
          Todavía no hay productos en esta categoría 👀
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} category={byCategory(p.category)} rotate={rotations[i % rotations.length]} />
          ))}
        </div>
      )}
    </section>
  );
}

import type { Product, Category } from "../data/products";
import { getProductReferenceImage } from "../data/product-reference-images";

const badgeStyles: Record<string, string> = {
  Importado: "bg-yellow text-ink",
  Promo: "bg-pink text-white",
  Nuevo: "bg-teal text-white",
};

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export default function ProductCard({ product, category, rotate }: { product: Product; category?: Category; rotate: number }) {
  const isReferenceImage = !product.image;
  const imageSrc = product.image ?? getProductReferenceImage(product);

  return (
    <div
      className="group relative rounded-3xl border-[3px] border-ink bg-white p-5 shadow-[4px_4px_0_var(--color-ink)] transition duration-200 hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--color-ink)]"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {product.badge && (
        <span className={`absolute -top-3 -right-3 rotate-6 rounded-full border-2 border-ink px-3 py-1 text-xs font-extrabold uppercase ${badgeStyles[product.badge]}`}>
          {product.badge}
        </span>
      )}

      {product.stock !== undefined && product.stock <= 0 && (
        <span className="absolute -top-3 -left-3 -rotate-6 rounded-full border-2 border-ink bg-ink px-3 py-1 text-xs font-extrabold uppercase text-cream">
          Sin stock
        </span>
      )}

      <div
        className="relative flex h-28 w-full items-center justify-center overflow-hidden rounded-2xl text-5xl sm:h-32"
        style={{ backgroundColor: `color-mix(in srgb, ${category?.color ?? "var(--color-pink)"} 18%, white)` }}
      >
        <span aria-hidden="true">{product.emoji}</span>
        <img
          src={imageSrc}
          alt={`${isReferenceImage ? "Foto de referencia de " : ""}${product.name}`}
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
        {isReferenceImage && (
          <span className="absolute bottom-2 left-2 rounded-full border border-white/70 bg-ink/70 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-white backdrop-blur-sm">
            Foto ilustrativa
          </span>
        )}
      </div>

      <p className="mt-4 text-xs font-extrabold uppercase tracking-wider text-ink/50">
        {category ? `${category.emoji} ${category.label}` : ""}
      </p>
      <h3 className="mt-1 font-display text-xl leading-tight text-ink">{product.name}</h3>

      <div className={`mt-3 flex items-end justify-between ${product.stock !== undefined && product.stock <= 0 ? "opacity-50" : ""}`}>
        <span className="font-display text-2xl text-pink">{currency.format(product.price)}</span>
        <span className="text-sm font-semibold text-ink/50">/ {product.unit}</span>
      </div>
    </div>
  );
}

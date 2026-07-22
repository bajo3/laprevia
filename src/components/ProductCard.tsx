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

type ProductCardProps = {
  product: Product;
  category?: Category;
  tiltClass: string;
  quantity: number;
  onChangeQuantity: (product: Product, delta: number) => void;
};

export default function ProductCard({
  product,
  category,
  tiltClass,
  quantity,
  onChangeQuantity,
}: ProductCardProps) {
  const isReferenceImage = !product.image;
  const imageSrc = product.image ?? getProductReferenceImage(product);
  const isOutOfStock = product.stock !== undefined && product.stock <= 0;
  const reachedStockLimit = product.stock !== undefined && quantity >= product.stock;

  return (
    <div
      className={`group relative flex flex-col rounded-3xl border-[3px] border-ink bg-white p-4 shadow-[4px_4px_0_var(--color-ink)] transition duration-200 hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--color-ink)] sm:p-5 ${tiltClass}`}
    >
      {product.badge && (
        <span className={`absolute -top-3 -right-3 rotate-6 rounded-full border-2 border-ink px-3 py-1 text-xs font-extrabold uppercase ${badgeStyles[product.badge]}`}>
          {product.badge}
        </span>
      )}

      {isOutOfStock && (
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

      <p className="mt-4 text-[11px] font-extrabold uppercase tracking-wider text-ink/50">
        {category ? `${category.emoji} ${category.label}` : ""}
      </p>
      <h3 className="mt-1 line-clamp-2 font-display text-lg leading-tight text-ink sm:text-xl">
        {product.name}
      </h3>

      <div className={`mt-2 flex items-end justify-between ${isOutOfStock ? "opacity-50" : ""}`}>
        <span className="font-display text-2xl text-pink">{currency.format(product.price)}</span>
        <span className="text-sm font-semibold text-ink/50">/ {product.unit}</span>
      </div>

      <div className="mt-3">
        {quantity > 0 ? (
          <div className="flex items-center justify-between rounded-full border-2 border-ink bg-yellow shadow-[3px_3px_0_var(--color-ink)]">
            <button
              type="button"
              onClick={() => onChangeQuantity(product, -1)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-l-full text-2xl font-black text-ink transition hover:bg-ink hover:text-yellow"
              aria-label={`Quitar una unidad de ${product.name}`}
            >
              −
            </button>
            <span
              className="font-display text-lg text-ink tabular-nums"
              aria-live="polite"
              aria-label={`${quantity} en el carrito`}
            >
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => onChangeQuantity(product, 1)}
              disabled={reachedStockLimit}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-r-full text-2xl font-black text-ink transition hover:bg-ink hover:text-yellow disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={`Agregar una unidad de ${product.name}`}
            >
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onChangeQuantity(product, 1)}
            disabled={isOutOfStock}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full border-2 border-ink bg-pink px-4 font-extrabold text-white shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isOutOfStock ? "Sin stock" : "＋ Agregar"}
          </button>
        )}
      </div>
    </div>
  );
}

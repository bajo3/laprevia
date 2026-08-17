import { useEffect, useState } from "react";
import type { Product, Category } from "../data/products";

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
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [product.image]);

  const imageSrc = product.image && !imageFailed ? product.image : undefined;

  return (
    <div
      className={`group relative flex flex-col rounded-3xl border-[3px] border-ink bg-white p-3 shadow-[4px_4px_0_var(--color-ink)] transition duration-200 hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--color-ink)] sm:p-5 ${tiltClass}`}
    >
      {product.badge && (
        <span className={`absolute -top-3 -right-3 rotate-6 rounded-full border-2 border-ink px-3 py-1 text-xs font-extrabold uppercase ${badgeStyles[product.badge]}`}>
          {product.badge}
        </span>
      )}

      <div
        className="relative flex h-28 w-full items-center justify-center overflow-hidden rounded-2xl text-5xl sm:h-32"
        style={{ backgroundColor: `color-mix(in srgb, ${category?.color ?? "var(--color-pink)"} 18%, white)` }}
      >
        {!imageSrc && <span aria-hidden="true">{product.emoji}</span>}
        {imageSrc && (
          <img
            src={imageSrc}
            alt={product.name}
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        )}
        {!imageSrc && (
          <span className="absolute bottom-2 left-2 rounded-full border border-white/70 bg-ink/70 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-white backdrop-blur-sm">
            Sin foto
          </span>
        )}
      </div>

      <p className="mt-3 text-[10px] font-extrabold uppercase tracking-wider text-ink/50 sm:mt-4 sm:text-[11px]">
        {category ? `${category.emoji} ${category.label}` : ""}
      </p>
      {/* Catalog names are long ("ABRILLANTADOR AEROSOL GLOBOS X1 GLOBBY"), so on
          phones they get a smaller size and a third line instead of being cut. */}
      <h3
        className="mt-1 line-clamp-3 font-display text-[13px] leading-tight text-ink min-[360px]:text-[15px] sm:text-xl"
        title={product.name}
      >
        {product.name}
      </h3>

      <div className="mt-2 flex items-end justify-between gap-1">
        <span className="font-display text-xl text-pink sm:text-2xl">{currency.format(product.price)}</span>
        <span className="shrink-0 text-xs font-semibold text-ink/50 sm:text-sm">/ {product.unit}</span>
      </div>

      {/* Stock is deliberately not shown in the public catalog — availability is
          confirmed by the shop over WhatsApp. The admin panel still shows it. */}

      {/* mt-auto pins the action row to the card bottom so the buttons line up
          across a grid row even when titles run to different line counts. */}
      <div className="mt-auto pt-3">
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
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-r-full text-2xl font-black text-ink transition hover:bg-ink hover:text-yellow"
              aria-label={`Agregar una unidad de ${product.name}`}
            >
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onChangeQuantity(product, 1)}
            className="flex h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-full border-2 border-ink bg-pink px-2 text-sm font-extrabold text-white shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 sm:px-4 sm:text-base"
          >
            ＋ Agregar
          </button>
        )}
      </div>
    </div>
  );
}

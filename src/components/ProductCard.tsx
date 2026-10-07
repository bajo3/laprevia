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
  isFavorite: boolean;
  onToggleFavorite: (product: Product) => void;
  onZoom: (product: Product) => void;
};

export default function ProductCard({
  product,
  category,
  tiltClass,
  quantity,
  onChangeQuantity,
  isFavorite,
  onToggleFavorite,
  onZoom,
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

      {/* aspect-square instead of a fixed pixel height: with h-28/h-32 the box
          stayed exactly as tall no matter how many columns the grid had, so
          its width — and with it the crop ratio — kept changing with every
          breakpoint: 1.15:1 at 2 columns on a phone, 1.61:1 at 4 columns on
          desktop. Almost every real photo in the catalog is portrait (a phone
          held vertically over the product, 480×640), so object-cover on that
          widening box was cropping away more and more of the photo's height
          as the screen got wider — over half of it gone at desktop width,
          which is what left products looking like a sliver of background with
          the item barely in frame. A square box holds one ratio at every
          width, so the crop stays the same modest amount everywhere. */}
      <div
        className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl text-5xl"
        style={{ backgroundColor: `color-mix(in srgb, ${category?.color ?? "var(--color-pink)"} 18%, white)` }}
      >
        {/* The section wins over the emoji stored on the product: the
            product was normalized before the section list finished loading. */}
        {!imageSrc && <span aria-hidden="true">{category?.emoji ?? product.emoji}</span>}
        {/* The photo is the way in to its own large version. The button
            carries the name, so the image inside stays silent rather than
            being announced twice. The focus ring is drawn inwards: the box
            clips its overflow, and a ring outside the edge would be cut off. */}
        {imageSrc && (
          <button
            type="button"
            onClick={() => onZoom(product)}
            aria-label={`Ver en grande la foto de ${product.name}`}
            className="absolute inset-0 cursor-zoom-in focus-visible:-outline-offset-4!"
          >
            <img
              src={imageSrc}
              alt=""
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
            />
          </button>
        )}
        {!imageSrc && (
          <span className="absolute bottom-2 left-2 rounded-full border border-white/70 bg-ink/70 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-white backdrop-blur-sm">
            Sin foto
          </span>
        )}

        {/* On the photo's corner rather than in the action row: that row is one
            full-width button on a 160px card, and splitting it would shrink
            "Agregar" below a comfortable tap. aria-pressed carries the state,
            so the label only has to say what the button is about. */}
        <button
          type="button"
          onClick={() => onToggleFavorite(product)}
          aria-pressed={isFavorite}
          aria-label={`${product.name}, favorito`}
          title={isFavorite ? "Quitar de favoritos" : "Guardar en favoritos"}
          className={`absolute right-1.5 top-1.5 flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink shadow-[2px_2px_0_var(--color-ink)] transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none ${
            isFavorite ? "bg-pink text-white" : "bg-white text-ink"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill={isFavorite ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 20.5s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1Z" />
          </svg>
        </button>
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
            // Without the product name a screen reader announces forty-eight
            // identical "Agregar" buttons with nothing to tell them apart.
            aria-label={`Agregar ${product.name} al carrito`}
            className="flex h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-full border-2 border-ink bg-pink px-2 text-sm font-extrabold text-white shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 sm:px-4 sm:text-base"
          >
            <span aria-hidden="true">＋ Agregar</span>
          </button>
        )}
      </div>
    </div>
  );
}

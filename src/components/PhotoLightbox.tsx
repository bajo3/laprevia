import { useEffect } from "react";
import type { Product } from "../data/products";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

type PhotoLightboxProps = {
  /** The product whose photo is open, or null when nothing is. */
  product: Product | null;
  quantity: number;
  onChangeQuantity: (product: Product, delta: number) => void;
  onClose: () => void;
};

/**
 * The product photo, large.
 *
 * On a phone the card shows the photo at about 130px, cropped to a square, and
 * for party supplies the photo is what decides the purchase: which shade, how
 * big, what is actually in the bag. Here it is shown whole — object-contain,
 * not the card's object-cover — at whatever size the screen allows.
 *
 * The cart control comes along so that looking closely and deciding does not
 * mean closing this, finding the card again and tapping there.
 */
export function PhotoLightbox({ product, quantity, onChangeQuantity, onClose }: PhotoLightboxProps) {
  useEffect(() => {
    if (!product) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [product, onClose]);

  if (!product?.image) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar la foto"
        onClick={onClose}
        className="absolute inset-0 cursor-zoom-out bg-ink/70 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-title"
        className="relative flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-3xl border-[3px] border-ink bg-white shadow-[6px_6px_0_var(--color-ink)]"
      >
        <button
          type="button"
          onClick={onClose}
          autoFocus
          aria-label="Cerrar la foto"
          className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-white text-xl font-black shadow-[2px_2px_0_var(--color-ink)] transition hover:-translate-y-0.5"
        >
          ×
        </button>

        {/* min-h-0 lets the photo give up height on a short screen instead of
            pushing the name and the button out of the dialog. */}
        <div className="flex min-h-0 flex-1 items-center justify-center bg-cream-dark">
          <img
            src={product.image}
            alt={product.name}
            className="max-h-[65vh] w-full object-contain"
            // A photo that fails here has nothing left to show.
            onError={onClose}
          />
        </div>

        <div className="border-t-[3px] border-ink p-4 sm:p-5">
          <h2 id="photo-title" className="font-display text-lg leading-tight text-ink sm:text-xl">
            {product.name}
          </h2>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="font-display text-2xl text-pink">
              {currency.format(product.price)}
              <span className="ml-1 font-body text-sm font-semibold text-ink/50">/ {product.unit}</span>
            </p>

            {quantity > 0 ? (
              <div className="flex items-center rounded-full border-2 border-ink bg-yellow shadow-[3px_3px_0_var(--color-ink)]">
                <button
                  type="button"
                  onClick={() => onChangeQuantity(product, -1)}
                  className="flex h-11 w-11 items-center justify-center rounded-l-full text-2xl font-black text-ink transition hover:bg-ink hover:text-yellow"
                  aria-label={`Quitar una unidad de ${product.name}`}
                >
                  −
                </button>
                <span
                  className="min-w-8 text-center font-display text-lg text-ink tabular-nums"
                  aria-live="polite"
                  aria-label={`${quantity} en el carrito`}
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => onChangeQuantity(product, 1)}
                  className="flex h-11 w-11 items-center justify-center rounded-r-full text-2xl font-black text-ink transition hover:bg-ink hover:text-yellow"
                  aria-label={`Agregar una unidad de ${product.name}`}
                >
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onChangeQuantity(product, 1)}
                className="flex h-11 items-center justify-center whitespace-nowrap rounded-full border-2 border-ink bg-pink px-5 font-extrabold text-white shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5"
              >
                ＋ Agregar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

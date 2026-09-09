import { useEffect, useMemo, useState } from "react";
import type { Product } from "../data/products";

import { whatsappOrderUrl } from "../data/site-config";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** The order travels inside the wa.me URL, and a wholesale order is exactly
 *  the kind that gets long: three lines already came to 944 characters, and
 *  forty would land near 14.000, where Android's WhatsApp intent and some
 *  browsers start truncating. Past this many lines the message carries the
 *  totals and asks the shop to confirm the rest, instead of arriving cut in
 *  half at an arbitrary product. */
const MAX_LINES_IN_MESSAGE = 25;

type CartLine = {
  product: Product;
  quantity: number;
};

type CartDrawerProps = {
  isOpen: boolean;
  lines: CartLine[];
  onClose: () => void;
  onChangeQuantity: (product: Product, delta: number) => void;
  onClear: () => void;
};

function buildWhatsAppMessage(lines: CartLine[], total: number, unitCount: number) {
  const shown = lines.slice(0, MAX_LINES_IN_MESSAGE);
  const hidden = lines.length - shown.length;

  // One line per product rather than two, and no rules made of box-drawing
  // characters: each of those weighed three bytes once URL-encoded, which is
  // budget spent on decoration instead of on the order itself.
  const productLines = shown
    .map(
      ({ product, quantity }, index) =>
        `${index + 1}. ${product.name} — ${quantity} × ${currency.format(product.price)} = *${currency.format(product.price * quantity)}*`,
    )
    .join("\n");

  return [
    "¡Hola! Quiero hacer este pedido en *La Previa* 🎉",
    "",
    productLines,
    ...(hidden > 0
      ? ["", `…y ${hidden} ${hidden === 1 ? "producto más" : "productos más"}, que les paso apenas me respondan.`]
      : []),
    "",
    `📦 ${lines.length} ${lines.length === 1 ? "producto" : "productos"} · ${unitCount} ${unitCount === 1 ? "unidad" : "unidades"}`,
    `💰 *TOTAL: ${currency.format(total)}*`,
    "",
    "¿Me confirman disponibilidad y forma de pago? ¡Gracias!",
  ].join("\n");
}

function CartProductThumb({ product }: { product: Product }) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [product.image]);

  return product.image && !imageFailed ? (
    <img src={product.image} alt="" className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
  ) : (
    <span aria-hidden="true">{product.emoji}</span>
  );
}

export function CartDrawer({
  isOpen,
  lines,
  onClose,
  onChangeQuantity,
  onClear,
}: CartDrawerProps) {
  const unitCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const whatsappUrl = useMemo(
    () => whatsappOrderUrl(buildWhatsAppMessage(lines, total, unitCount)),
    [lines, total, unitCount],
  );

  useEffect(() => {
    if (!isOpen) return undefined;

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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        aria-label="Cerrar carrito"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/55 backdrop-blur-sm"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col overflow-hidden rounded-t-[2rem] border-[3px] border-b-0 border-ink bg-cream shadow-[0_-8px_0_rgba(36,24,52,0.22)] sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:max-w-md sm:rounded-none sm:border-b-[3px]"
      >
        <div className="flex items-center justify-between border-b-[3px] border-ink bg-yellow px-5 py-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink/55">
              Tu selección
            </p>
            <h2 id="cart-title" className="font-display text-3xl text-ink">
              Carrito ({unitCount})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-white text-xl font-black shadow-[2px_2px_0_var(--color-ink)] transition hover:-translate-y-0.5"
            aria-label="Cerrar carrito"
          >
            ×
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
            <span className="text-6xl" aria-hidden="true">
              🛒
            </span>
            <p className="mt-5 font-display text-2xl">Tu carrito está vacío</p>
            <p className="mt-2 text-sm text-ink/55">
              Agregá productos del catálogo para preparar tu pedido.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 rounded-full border-2 border-ink bg-pink px-6 py-3 font-extrabold text-white shadow-[3px_3px_0_var(--color-ink)]"
            >
              Seguir mirando
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {lines.map(({ product, quantity }) => (
                <article
                  key={product.id}
                  className="rounded-2xl border-2 border-ink/15 bg-white p-4"
                >
                  <div className="flex gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-cream-dark text-2xl">
                      <CartProductThumb product={product} />
                    </span>
                    <div className="min-w-0 flex-1">
                      {/* Two lines instead of truncating: in the cart the shopper
                          needs to recognise what they are about to order. */}
                      <h3 className="line-clamp-2 font-display text-base leading-tight text-ink sm:text-lg">
                        {product.name}
                      </h3>
                      <p className="mt-0.5 text-sm font-bold text-pink">
                        {currency.format(product.price)} c/u
                      </p>
                    </div>
                    <p className="shrink-0 font-display text-lg text-ink">
                      {currency.format(product.price * quantity)}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center rounded-full border-2 border-ink bg-cream">
                      <button
                        type="button"
                        onClick={() => onChangeQuantity(product, -1)}
                        className="flex h-9 w-9 items-center justify-center rounded-l-full text-xl font-black transition hover:bg-pink hover:text-white"
                        aria-label={`Quitar una unidad de ${product.name}`}
                      >
                        −
                      </button>
                      <span className="min-w-9 text-center font-extrabold" aria-live="polite">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onChangeQuantity(product, 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-r-full text-xl font-black transition hover:bg-teal hover:text-white"
                        aria-label={`Agregar una unidad de ${product.name}`}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => onChangeQuantity(product, -quantity)}
                      className="text-xs font-extrabold uppercase tracking-wide text-ink/45 underline decoration-2 underline-offset-4 hover:text-pink"
                    >
                      Quitar
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="border-t-[3px] border-ink bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
              <div className="rounded-2xl bg-navy p-5 text-cream shadow-[4px_4px_0_var(--color-yellow)]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold uppercase tracking-widest text-cream/60">
                    Total estimado
                  </span>
                  <span className="font-display text-4xl text-yellow">{currency.format(total)}</span>
                </div>
                <p className="mt-2 text-xs text-cream/55">
                  El negocio confirmará stock, precio final y forma de pago.
                </p>
                {lines.length > MAX_LINES_IN_MESSAGE && (
                  <p className="mt-2 text-xs font-bold text-yellow">
                    El mensaje lleva los primeros {MAX_LINES_IN_MESSAGE} productos y el total
                    de los {lines.length}. El resto se lo pasás por chat.
                  </p>
                )}
              </div>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border-[3px] border-ink bg-teal px-4 py-4 font-display text-lg text-white shadow-[4px_4px_0_var(--color-ink)] transition hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--color-ink)] sm:px-5 sm:text-xl"
              >
                <span aria-hidden="true">💬</span>
                Enviar pedido por WhatsApp
              </a>

              <button
                type="button"
                onClick={onClear}
                className="mt-4 w-full text-xs font-extrabold uppercase tracking-widest text-ink/40 hover:text-pink"
              >
                Vaciar carrito
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

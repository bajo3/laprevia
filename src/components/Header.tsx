import { WHATSAPP_CATALOG_URL } from "../data/site-config";

type HeaderProps = {
  cartCount: number;
  onCartOpen: () => void;
  favoriteCount: number;
  onFavoritesOpen: () => void;
};

export default function Header({ cartCount, onCartOpen, favoriteCount, onFavoritesOpen }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b-4 border-ink bg-cream/90 backdrop-blur">
      {/* Fixed 60px + 4px border = 64px on mobile, so CategoryNav's sticky
          `top-16` docks flush against it with no gap. */}
      <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between px-5 sm:h-auto sm:py-3">
        <a href="#top" className="flex items-center gap-2">
          <span className="font-display text-2xl text-pink sm:text-3xl">La Previa</span>
          <span className="hidden rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-cream sm:inline">
            Distribuidora
          </span>
        </a>

        <nav className="hidden items-center gap-6 font-bold text-ink md:flex">
          <a href="#categorias" className="hover:text-pink">Categorías</a>
          <a href="#catalogo" className="hover:text-pink">Catálogo</a>
          <a href="#contacto" className="hover:text-pink">Contacto</a>
        </nav>

        {/* gap-3, not gap-2: each button's count badge hangs 8px past its
            right edge, which was exactly the old gap — the favourites badge
            sat touching the cart button. */}
        <div className="flex items-center gap-3">
          <a
            href={WHATSAPP_CATALOG_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-full bg-teal px-4 py-2 text-sm font-extrabold text-white shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] sm:block"
          >
            WhatsApp
          </a>
          {/* The chip on the section rail is the other way in, but on a
              desktop that rail is not sticky: three screens down the catalog
              there was no way back to the favourites short of scrolling up.
              The header is always on screen. */}
          <button
            type="button"
            onClick={onFavoritesOpen}
            className="relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-white text-ink shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5"
            aria-label={
              favoriteCount === 0
                ? "Ver favoritos, todavía no guardaste ninguno"
                : `Ver favoritos, ${favoriteCount} ${favoriteCount === 1 ? "guardado" : "guardados"}`
            }
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-5 w-5 ${favoriteCount > 0 ? "text-pink" : ""}`}
              fill={favoriteCount > 0 ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 20.5s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1Z" />
            </svg>
            {favoriteCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-ink bg-ink px-1 text-xs font-extrabold text-cream tabular-nums">
                {favoriteCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onCartOpen}
            className="relative flex h-11 items-center justify-center gap-1.5 rounded-full border-2 border-ink bg-yellow px-4 text-sm font-extrabold text-ink shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5"
            aria-label={
              cartCount === 0
                ? "Abrir carrito, está vacío"
                : `Abrir carrito con ${cartCount} ${cartCount === 1 ? "unidad" : "unidades"}`
            }
          >
            <span aria-hidden="true">🛒</span>
            <span className="hidden sm:inline">Carrito</span>
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-ink bg-pink px-1 text-xs text-white">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

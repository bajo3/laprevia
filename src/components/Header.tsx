const WHATSAPP_URL = "https://wa.me/c/5492494009317";

type HeaderProps = {
  cartCount: number;
  onCartOpen: () => void;
};

export default function Header({ cartCount, onCartOpen }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b-4 border-ink bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
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

        <div className="flex items-center gap-2">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-full bg-teal px-4 py-2 text-sm font-extrabold text-white shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] sm:block"
          >
            WhatsApp
          </a>
          <button
            type="button"
            onClick={onCartOpen}
            className="relative rounded-full border-2 border-ink bg-yellow px-4 py-2 text-sm font-extrabold text-ink shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5"
            aria-label={`Abrir carrito con ${cartCount} unidades`}
          >
            🛒 <span className="hidden sm:inline">Carrito</span>
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

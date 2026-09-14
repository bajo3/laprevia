import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import CategoryNav from "./components/CategoryNav";
import ProductGrid from "./components/ProductGrid";
import { SearchBar } from "./components/SearchBar";
import { CartDrawer } from "./components/CartDrawer";
import InfoTicket from "./components/InfoTicket";
import Footer from "./components/Footer";
import { useCategories } from "./data/catalog-config";
import { fetchCatalogPage, refreshCategories } from "./data/catalog-api";
import { WHATSAPP_CHAT_URL } from "./data/site-config";
import type { Product } from "./data/products";

const AdminDashboard = lazy(() => import("./admin/AdminDashboard"));

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** The cart keeps a snapshot of each product. Results are paged now, so a
 *  product in the cart is often no longer in the page on screen — deriving the
 *  cart from the visible list would silently drop those lines.
 *
 *  `addedAt` exists because the cart is keyed by product id, and those ids are
 *  numeric strings ("3204869"). JavaScript orders integer-like keys
 *  numerically, so `Object.values` handed back the lines sorted by id rather
 *  than in the order the shopper built the order. */
type CartEntry = { product: Product; quantity: number; addedAt: number };

const CART_KEY = "laprevia-carrito";
/** A cart older than this is dropped rather than restored: prices move with
 *  every price list, and reviving a week-old order would show numbers the shop
 *  can no longer honour. */
const CART_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;

type StoredCart = { savedAt: number; entries: CartEntry[] };

function readStoredCart(): Record<string, CartEntry> {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredCart;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > CART_MAX_AGE_MS) return {};
    const restored: Record<string, CartEntry> = {};
    for (const entry of parsed.entries ?? []) {
      if (!entry?.product?.id || !(entry.quantity > 0)) continue;
      restored[entry.product.id] = entry;
    }
    return restored;
  } catch {
    // A private window, cleared storage or a half-written value: start empty
    // rather than break the catalog over a convenience feature.
    return {};
  }
}

function PublicCatalog() {
  const { categories, isLoaded: areSectionsLoaded } = useCategories();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [cart, setCart] = useState<Record<string, CartEntry>>(readStoredCart);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);

  /** Guards against a slow earlier request overwriting a newer one. */
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  /** The sections are the shop's to edit from the panel, so the nav rail is
   *  read from the server like the products are. */
  useEffect(() => {
    void refreshCategories();
  }, []);

  /** Survives a reload and, on a phone, the trip out to WhatsApp and back. */
  useEffect(() => {
    try {
      const entries = Object.values(cart);
      if (!entries.length) localStorage.removeItem(CART_KEY);
      else localStorage.setItem(CART_KEY, JSON.stringify({ savedAt: Date.now(), entries } satisfies StoredCart));
    } catch {
      // Storage can be unavailable or full; the cart still works in memory.
    }
  }, [cart]);

  const loadFirstPage = useCallback(async () => {
    const id = ++requestId.current;
    setIsCatalogLoading(true);
    try {
      const page = await fetchCatalogPage({ query: debouncedQuery, category: activeCategory });
      if (id !== requestId.current) return;
      setProducts(page.products);
      setTotal(page.total);
      setHasLoadError(false);
    } catch {
      if (id !== requestId.current) return;
      setProducts([]);
      setTotal(0);
      setHasLoadError(true);
    } finally {
      if (id === requestId.current) setIsCatalogLoading(false);
    }
  }, [activeCategory, debouncedQuery]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  /** A section can be deleted from the panel while the catalog is open on
   *  someone's phone. Without this the shopper is left filtering by a section
   *  that no longer exists, looking at an empty grid with no way back other
   *  than the chip they cannot see is gone. */
  useEffect(() => {
    if (!areSectionsLoaded || !activeCategory) return;
    if (!categories.some((category) => category.slug === activeCategory)) setActiveCategory(null);
  }, [activeCategory, areSectionsLoaded, categories]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    const offset = products.length;
    try {
      const page = await fetchCatalogPage({ query: debouncedQuery, category: activeCategory, offset });
      setProducts((current) => [...current, ...page.products]);
      setTotal(page.total);
    } catch {
      // Keep what is already on screen; the button stays available to retry.
    } finally {
      setIsLoadingMore(false);
    }
  }, [activeCategory, debouncedQuery, isLoadingMore, products.length]);

  /** Sorted by when each line was added, because the object's own key order is
   *  numeric — see the note on CartEntry. */
  const cartLines = useMemo(
    () => Object.values(cart).sort((a, b) => a.addedAt - b.addedAt),
    [cart],
  );

  const quantities = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [id, entry] of Object.entries(cart)) map[id] = entry.quantity;
    return map;
  }, [cart]);

  const cartCount = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.quantity, 0),
    [cartLines],
  );

  const cartTotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    [cartLines],
  );

  const changeQuantity = useCallback((product: Product, delta: number) => {
    setCart((current) => {
      const existing = current[product.id];
      const currentQuantity = existing?.quantity ?? 0;
      // No stock ceiling: the catalog does not publish stock, so silently
      // refusing to increment would be unexplainable to the shopper. The shop
      // confirms availability when the WhatsApp order arrives.
      const nextQuantity = Math.max(0, currentQuantity + delta);

      if (nextQuantity === 0) {
        const nextCart = { ...current };
        delete nextCart[product.id];
        return nextCart;
      }

      // Two taps inside the same millisecond would otherwise tie, and a tie
      // falls back to the object's numeric key order — the very thing this
      // field exists to avoid. Stepping past the highest position in use keeps
      // every line strictly ordered.
      const lastPosition = Object.values(current).reduce((max, line) => Math.max(max, line.addedAt), 0);

      return {
        ...current,
        // A line keeps the position it was given when it first went in, so
        // changing a quantity does not shuffle the order around.
        [product.id]: {
          product,
          quantity: nextQuantity,
          addedAt: existing?.addedAt ?? Math.max(Date.now(), lastPosition + 1),
        },
      };
    });
  }, []);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const clearCart = useCallback(() => setCart({}), []);

  return (
    <>
      <Header cartCount={cartCount} onCartOpen={openCart} />
      <main id="contenido">
        <Hero />

        <p className="mx-auto mt-6 mb-2 max-w-2xl px-5 text-center text-sm text-ink/60 sm:mt-10 sm:rounded-2xl sm:border-2 sm:border-dashed sm:border-ink/30 sm:py-3">
          🧾 Armá tu pedido y envialo por WhatsApp. El total es estimado y se confirma al responderte.
        </p>

        <SearchBar
          query={query}
          resultCount={total}
          isSearching={isCatalogLoading}
          onQueryChange={setQuery}
        />
        {/* Empty until the list arrives: the "Todo" chip is there from the
            first paint, and the sections appear rather than the built-in list
            flashing and being rewritten under the shopper. */}
        <CategoryNav categories={areSectionsLoaded ? categories : []} active={activeCategory} onSelect={setActiveCategory} />

        {/* Says so plainly instead of quietly serving a saved copy: the prices
            in one of those copies go stale, and a wrong wholesale price is an
            argument at the counter. */}
        {hasLoadError && !isCatalogLoading && (
          <div className="mx-auto max-w-2xl px-5 pb-10" role="alert">
            <div className="rounded-3xl border-[3px] border-ink bg-white p-6 text-center shadow-[4px_4px_0_var(--color-ink)]">
              <p className="text-4xl" aria-hidden="true">📡</p>
              <p className="font-display mt-3 text-2xl">No pudimos cargar el catálogo</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink/60">
                Puede ser un problema momentáneo. Probá de nuevo en un minuto, o escribinos
                y te pasamos precios y disponibilidad al toque.
              </p>
              <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void loadFirstPage()}
                  className="rounded-full border-2 border-ink bg-yellow px-5 py-3 font-extrabold shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5"
                >
                  Reintentar
                </button>
                <a
                  href={WHATSAPP_CHAT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border-2 border-ink bg-teal px-5 py-3 font-extrabold text-white shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5"
                >
                  Escribinos por WhatsApp
                </a>
              </div>
            </div>
          </div>
        )}

        {!hasLoadError && (
          <ProductGrid
            products={products}
            categories={categories}
            quantities={quantities}
            onChangeQuantity={changeQuantity}
            isLoading={isCatalogLoading}
            isLoadingMore={isLoadingMore}
            hasMore={products.length < total}
            totalCount={total}
            onLoadMore={loadMore}
          />
        )}
        <InfoTicket />
      </main>
      <Footer hasFloatingBar={cartCount > 0} />

      {cartCount > 0 && (
        <button
          type="button"
          onClick={openCart}
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-full border-[3px] border-ink bg-yellow px-5 py-3 text-ink shadow-[5px_5px_0_var(--color-ink)] transition hover:-translate-y-1 hover:shadow-[7px_7px_0_var(--color-ink)] sm:left-auto sm:right-6 sm:w-auto sm:translate-x-0"
          aria-label={`Abrir carrito con ${cartCount} ${cartCount === 1 ? "unidad" : "unidades"}, total ${currency.format(cartTotal)}`}
        >
          <span className="truncate font-extrabold">🛒 Ver carrito · {cartCount}</span>
          <span className="shrink-0 font-display text-xl">{currency.format(cartTotal)}</span>
        </button>
      )}

      <CartDrawer
        isOpen={isCartOpen}
        lines={cartLines}
        onClose={closeCart}
        onChangeQuantity={changeQuantity}
        onClear={clearCart}
      />
    </>
  );
}

/** Only /admin and paths under it, not everything that merely starts with
 *  those letters — "/administracion" was opening the panel too. */
function isAdminRoute(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function App() {
  return isAdminRoute(window.location.pathname) ? (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-cream p-6 text-center"><p className="font-display text-3xl">Cargando panel…</p></div>}>
      <AdminDashboard />
    </Suspense>
  ) : <PublicCatalog />;
}

export default App;

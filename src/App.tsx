import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import CategoryNav from "./components/CategoryNav";
import ProductGrid from "./components/ProductGrid";
import { SearchBar } from "./components/SearchBar";
import { CartDrawer } from "./components/CartDrawer";
import { PhotoLightbox } from "./components/PhotoLightbox";
import InfoTicket from "./components/InfoTicket";
import Footer from "./components/Footer";
import { useCategories } from "./data/catalog-config";
import { fetchCatalogPage, refreshCategories } from "./data/catalog-api";
import { MAX_FAVORITES, useFavorites } from "./data/favorites";
import { WHATSAPP_CHAT_URL } from "./data/site-config";
import type { Product } from "./data/products";

const AdminDashboard = lazy(() => import("./admin/AdminDashboard"));
const PriceChecker = lazy(() => import("./precios/PriceChecker"));

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
  const { ids: favoriteIds, idSet: favoriteIdSet, toggle: toggleFavoriteId } = useFavorites();
  const [showFavorites, setShowFavorites] = useState(false);
  /** Favourites the server did not send back: products that dropped off the
   *  last price list. They stay saved — an article that returns with the next
   *  list comes back as a favourite — so the view says how many are missing
   *  instead of quietly showing fewer than the chip counts. */
  const [unavailableFavorites, setUnavailableFavorites] = useState(0);

  /** Guards against a slow earlier request overwriting a newer one. */
  const requestId = useRef(0);

  /** Read through a ref so that un-marking a favourite while looking at the
   *  favourites does not reload the list under the shopper's finger; the card
   *  is simply dropped from what is already on screen. */
  const favoriteIdsRef = useRef(favoriteIds);
  useEffect(() => {
    favoriteIdsRef.current = favoriteIds;
  }, [favoriteIds]);
  /** The ids the list on screen was asked for. "Mostrar más" has to page
   *  through that same set, or removing one mid-way would shift every offset
   *  and skip a product. */
  const viewIdsRef = useRef<string[] | undefined>(undefined);

  /** The product whose photo is open large, if any. */
  const [zoomedProduct, setZoomedProduct] = useState<Product | null>(null);
  /** Just above the results: where the page goes when the list is replaced. */
  const resultsTopRef = useRef<HTMLDivElement>(null);
  /** Set when the results should be brought into view once they have loaded,
   *  wherever the shopper happens to be on the page. */
  const scrollToResultsRef = useRef(false);

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
    const ids = showFavorites ? favoriteIdsRef.current : undefined;
    viewIdsRef.current = ids;
    try {
      const page = await fetchCatalogPage({
        query: debouncedQuery,
        category: activeCategory,
        ids,
        // Favourites come in one piece rather than a page at a time: "agregar
        // todos al carrito" has to mean all of them, not the first 48, and the
        // list is capped at MAX_FAVORITES anyway.
        limit: ids ? MAX_FAVORITES : undefined,
      });
      if (id !== requestId.current) return;
      setProducts(page.products);
      setTotal(page.total);
      // Only meaningful without a search: with one, a favourite that is not
      // listed may simply not match what was typed.
      setUnavailableFavorites(ids && !debouncedQuery.trim() ? Math.max(0, ids.length - page.total) : 0);
      setHasLoadError(false);
    } catch {
      if (id !== requestId.current) return;
      setProducts([]);
      setTotal(0);
      setUnavailableFavorites(0);
      setHasLoadError(true);
    } finally {
      if (id === requestId.current) setIsCatalogLoading(false);
    }
  }, [activeCategory, debouncedQuery, showFavorites]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  /** Brings the top of a freshly loaded list into view.
   *
   *  It waits for the list instead of scrolling on the tap. Scrolling first
   *  and loading second left the browser holding the first card in place while
   *  the "agregar todos" bar was inserted above it — on a phone, underneath the
   *  sticky section rail, where nobody would see it.
   *
   *  The same thing was already wrong for the section chips: on a phone the
   *  rail is sticky, so a section can be picked from deep in the list, and a
   *  short section then left the shopper past its end, looking at the footer.
   *  Whenever the top of the results is above the screen, a new list starts
   *  from its beginning. */
  useEffect(() => {
    if (isCatalogLoading) return;
    const anchor = resultsTopRef.current;
    if (anchor && (scrollToResultsRef.current || anchor.getBoundingClientRect().top < 0)) {
      anchor.scrollIntoView();
    }
    scrollToResultsRef.current = false;
  }, [isCatalogLoading]);

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
      const page = await fetchCatalogPage({
        query: debouncedQuery,
        category: activeCategory,
        ids: viewIdsRef.current,
        offset,
      });
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

  /** Puts one unit of each product in the cart, skipping what is already
   *  there. Skipping is what makes the button safe to press twice: a shop that
   *  already set "12" on something does not get it bumped to 13, and a second
   *  tap does not double the order. */
  const addManyToCart = useCallback((items: Product[]) => {
    setCart((current) => {
      const next = { ...current };
      let position = Math.max(Date.now(), ...Object.values(current).map((line) => line.addedAt + 1));
      for (const product of items) {
        if (next[product.id]) continue;
        next[product.id] = { product, quantity: 1, addedAt: position };
        position += 1;
      }
      return next;
    });
  }, []);

  /** In the favourites view a product stops being listed the moment its heart
   *  is un-marked. The counts follow, so "3 productos" never sits above two
   *  cards. */
  const visibleProducts = useMemo(
    () => (showFavorites ? products.filter((product) => favoriteIdSet.has(product.id)) : products),
    [favoriteIdSet, products, showFavorites],
  );
  const visibleTotal = total - (products.length - visibleProducts.length);

  const toggleFavorite = useCallback((product: Product) => toggleFavoriteId(product.id), [toggleFavoriteId]);

  /** Favourites and sections are two ways of narrowing the same list, and only
   *  one is active at a time: picking either leaves the other. */
  const selectCategory = useCallback((slug: string | null) => {
    setShowFavorites(false);
    setActiveCategory(slug);
  }, []);
  const selectFavorites = useCallback(() => {
    setActiveCategory(null);
    setShowFavorites(true);
  }, []);
  /** From the header the favourites can be opened from anywhere on the page,
   *  so the list also has to be brought into view. */
  const openFavorites = useCallback(() => {
    // Already on the favourites: nothing will load, so there is nothing to
    // wait for.
    if (showFavorites) resultsTopRef.current?.scrollIntoView();
    else scrollToResultsRef.current = true;
    selectFavorites();
  }, [selectFavorites, showFavorites]);

  /** Focus goes back to the photo that opened the large view, so a keyboard
   *  user lands where they were instead of at the top of the page. The opener
   *  is noted here, on the click: by the time the dialog's own effects run,
   *  its close button has already taken the focus. */
  const zoomOpenerRef = useRef<HTMLElement | null>(null);
  const openZoom = useCallback((product: Product) => {
    zoomOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setZoomedProduct(product);
  }, []);
  const closeZoom = useCallback(() => {
    setZoomedProduct(null);
    zoomOpenerRef.current?.focus();
    zoomOpenerRef.current = null;
  }, []);

  const favoritesNotInCart = useMemo(
    () => (showFavorites ? visibleProducts.filter((product) => !cart[product.id]) : []),
    [cart, showFavorites, visibleProducts],
  );

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const clearCart = useCallback(() => setCart({}), []);

  return (
    <>
      <Header
        cartCount={cartCount}
        onCartOpen={openCart}
        favoriteCount={favoriteIds.length}
        onFavoritesOpen={openFavorites}
      />
      <main id="contenido">
        <Hero />

        <p className="mx-auto mt-6 mb-2 max-w-2xl px-5 text-center text-sm text-ink/60 sm:mt-10 sm:rounded-2xl sm:border-2 sm:border-dashed sm:border-ink/30 sm:py-3">
          🧾 Armá tu pedido y envialo por WhatsApp. El total es estimado y se confirma al responderte.
        </p>

        <SearchBar
          query={query}
          resultCount={visibleTotal}
          isSearching={isCatalogLoading}
          onQueryChange={setQuery}
        />
        {/* Empty until the list arrives: the "Todo" chip is there from the
            first paint, and the sections appear rather than the built-in list
            flashing and being rewritten under the shopper. */}
        <CategoryNav
          categories={areSectionsLoaded ? categories : []}
          active={activeCategory}
          onSelect={selectCategory}
          favoriteCount={favoriteIds.length}
          isShowingFavorites={showFavorites}
          onSelectFavorites={selectFavorites}
        />
        <div ref={resultsTopRef} />

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

        {showFavorites && !hasLoadError && !isCatalogLoading && unavailableFavorites > 0 && visibleProducts.length > 0 && (
          <p className="mx-auto mb-5 max-w-2xl px-5 text-center text-sm font-bold text-ink/55" role="status">
            {unavailableFavorites === 1
              ? "Uno de tus favoritos no está disponible por ahora. Si vuelve al catálogo, lo vas a ver acá."
              : `${unavailableFavorites} de tus favoritos no están disponibles por ahora. Si vuelven al catálogo, los vas a ver acá.`}
          </p>
        )}

        {/* What turns a list of favourites into next week's order: a kiosk
            that buys the same things marks them once and fills the cart from
            here. */}
        {showFavorites && !hasLoadError && !isCatalogLoading && visibleProducts.length > 0 && (
          <div className="mx-auto mb-6 flex max-w-6xl flex-col items-center gap-3 px-5 pt-4 sm:flex-row sm:justify-center sm:pt-0">
            {favoritesNotInCart.length > 0 ? (
              <button
                type="button"
                onClick={() => addManyToCart(favoritesNotInCart)}
                className="w-full rounded-full border-[3px] border-ink bg-pink px-6 py-3 font-extrabold text-white shadow-[4px_4px_0_var(--color-ink)] transition hover:-translate-y-0.5 sm:w-auto"
              >
                <span aria-hidden="true">🛒 </span>
                {favoritesNotInCart.length === visibleProducts.length
                  ? favoritesNotInCart.length === 1
                    ? "Agregar al carrito"
                    : `Agregar los ${favoritesNotInCart.length} al carrito`
                  : favoritesNotInCart.length === 1
                    ? "Agregar el que falta al carrito"
                    : `Agregar los ${favoritesNotInCart.length} que faltan al carrito`}
              </button>
            ) : (
              <>
                <p className="text-sm font-bold text-ink/60" role="status">
                  ✓ {visibleProducts.length === 1 ? "Ya está en el carrito" : "Ya están todos en el carrito"}
                </p>
                <button
                  type="button"
                  onClick={openCart}
                  className="rounded-full border-2 border-ink bg-yellow px-5 py-2.5 text-sm font-extrabold shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5"
                >
                  Ver carrito
                </button>
              </>
            )}
          </div>
        )}

        {!hasLoadError && (
          <ProductGrid
            products={visibleProducts}
            categories={categories}
            quantities={quantities}
            onChangeQuantity={changeQuantity}
            favoriteIds={favoriteIdSet}
            onToggleFavorite={toggleFavorite}
            onZoom={openZoom}
            emptyState={
              // With something typed in the search box the stock "nothing
              // matched" message is the right one, so this only steps in for
              // an empty favourites list.
              showFavorites && !debouncedQuery.trim() ? (
                <div className="py-16 text-center">
                  <p className="text-5xl" aria-hidden="true">
                    {unavailableFavorites > 0 ? "📦" : "❤️"}
                  </p>
                  <p className="font-display mt-4 text-2xl text-ink/70">
                    {unavailableFavorites > 0
                      ? "Tus favoritos no están disponibles por ahora"
                      : "Todavía no guardaste favoritos"}
                  </p>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-ink/50">
                    {unavailableFavorites > 0
                      ? "Salieron de la última lista de precios. Si vuelven al catálogo, los vas a ver acá."
                      : "Tocá el corazón de un producto para tenerlo a mano acá. Quedan guardados en este dispositivo."}
                  </p>
                  <button
                    type="button"
                    onClick={() => selectCategory(null)}
                    className="mt-6 rounded-full border-2 border-ink bg-yellow px-5 py-3 font-extrabold shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5"
                  >
                    Ver todo el catálogo
                  </button>
                </div>
              ) : undefined
            }
            isLoading={isCatalogLoading}
            isLoadingMore={isLoadingMore}
            hasMore={products.length < total}
            totalCount={visibleTotal}
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

      <PhotoLightbox
        product={zoomedProduct}
        quantity={zoomedProduct ? (quantities[zoomedProduct.id] ?? 0) : 0}
        onChangeQuantity={changeQuantity}
        onClose={closeZoom}
      />
    </>
  );
}

/** Only /admin and paths under it, not everything that merely starts with
 *  those letters — "/administracion" was opening the panel too. */
function isAdminRoute(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isPriceCheckerRoute(pathname: string) {
  return pathname === "/precios" || pathname.startsWith("/precios/");
}

function App() {
  if (isPriceCheckerRoute(window.location.pathname)) {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-cream p-6 text-center"><p className="font-display text-3xl">Cargando…</p></div>}>
        <PriceChecker />
      </Suspense>
    );
  }
  return isAdminRoute(window.location.pathname) ? (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-cream p-6 text-center"><p className="font-display text-3xl">Cargando panel…</p></div>}>
      <AdminDashboard />
    </Suspense>
  ) : <PublicCatalog />;
}

export default App;

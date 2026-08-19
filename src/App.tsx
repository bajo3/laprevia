import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import CategoryNav from "./components/CategoryNav";
import ProductGrid from "./components/ProductGrid";
import { SearchBar } from "./components/SearchBar";
import { CartDrawer } from "./components/CartDrawer";
import InfoTicket from "./components/InfoTicket";
import Footer from "./components/Footer";
import { categories } from "./data/catalog-config";
import { fetchBundledCatalog, fetchCatalogPage, PAGE_SIZE } from "./data/catalog-api";
import type { Product } from "./data/products";

const AdminDashboard = lazy(() => import("./admin/AdminDashboard"));

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const normalizeSearch = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** The cart keeps a snapshot of each product. Results are paged now, so a
 *  product in the cart is often no longer in the page on screen — deriving the
 *  cart from the visible list would silently drop those lines. */
type CartEntry = { product: Product; quantity: number };

function matchesLocally(product: Product, query: string, category: string | null) {
  const normalizedQuery = normalizeSearch(query.trim());
  const matchesCategory = !category || product.category === category;
  const matchesSearch =
    !normalizedQuery ||
    normalizeSearch(product.name).includes(normalizedQuery) ||
    product.id.includes(normalizedQuery) ||
    normalizeSearch(product.code ?? "").includes(normalizedQuery);
  return matchesCategory && matchesSearch;
}

function PublicCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);

  /** Populated only when the API is unreachable: the whole bundled catalog is
   *  held in memory and filtered in the browser, as before. */
  const fallbackCatalog = useRef<Product[] | null>(null);
  /** Guards against a slow earlier request overwriting a newer one. */
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const loadFirstPage = useCallback(async () => {
    const id = ++requestId.current;
    setIsCatalogLoading(true);

    const applyFallback = (all: Product[]) => {
      const matches = all.filter((product) => matchesLocally(product, debouncedQuery, activeCategory));
      if (id !== requestId.current) return;
      setProducts(matches.slice(0, PAGE_SIZE));
      setTotal(matches.length);
    };

    try {
      if (fallbackCatalog.current) {
        applyFallback(fallbackCatalog.current);
        return;
      }
      const page = await fetchCatalogPage({ query: debouncedQuery, category: activeCategory });
      if (id !== requestId.current) return;
      setProducts(page.products);
      setTotal(page.total);
    } catch {
      try {
        const all = fallbackCatalog.current ?? (await fetchBundledCatalog());
        fallbackCatalog.current = all;
        applyFallback(all);
      } catch {
        if (id !== requestId.current) return;
        setProducts([]);
        setTotal(0);
      }
    } finally {
      if (id === requestId.current) setIsCatalogLoading(false);
    }
  }, [activeCategory, debouncedQuery]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    const offset = products.length;
    try {
      if (fallbackCatalog.current) {
        const matches = fallbackCatalog.current.filter((product) =>
          matchesLocally(product, debouncedQuery, activeCategory),
        );
        setProducts(matches.slice(0, offset + PAGE_SIZE));
      } else {
        const page = await fetchCatalogPage({ query: debouncedQuery, category: activeCategory, offset });
        setProducts((current) => [...current, ...page.products]);
        setTotal(page.total);
      }
    } catch {
      // Keep what is already on screen; the button stays available to retry.
    } finally {
      setIsLoadingMore(false);
    }
  }, [activeCategory, debouncedQuery, isLoadingMore, products.length]);

  const cartLines = useMemo(() => Object.values(cart), [cart]);

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
      const currentQuantity = current[product.id]?.quantity ?? 0;
      // No stock ceiling: the catalog does not publish stock, so silently
      // refusing to increment would be unexplainable to the shopper. The shop
      // confirms availability when the WhatsApp order arrives.
      const nextQuantity = Math.max(0, currentQuantity + delta);

      if (nextQuantity === 0) {
        const nextCart = { ...current };
        delete nextCart[product.id];
        return nextCart;
      }

      return { ...current, [product.id]: { product, quantity: nextQuantity } };
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
        <CategoryNav categories={categories} active={activeCategory} onSelect={setActiveCategory} />
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
        <InfoTicket />
      </main>
      <Footer hasFloatingBar={cartCount > 0} />

      {cartCount > 0 && (
        <button
          type="button"
          onClick={openCart}
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-full border-[3px] border-ink bg-yellow px-5 py-3 text-ink shadow-[5px_5px_0_var(--color-ink)] transition hover:-translate-y-1 hover:shadow-[7px_7px_0_var(--color-ink)] sm:left-auto sm:right-6 sm:w-auto sm:translate-x-0"
          aria-label={`Abrir carrito con ${cartCount} unidades`}
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

function App() {
  return window.location.pathname.startsWith("/admin") ? (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-cream p-6 text-center"><p className="font-display text-3xl">Cargando panel…</p></div>}>
      <AdminDashboard />
    </Suspense>
  ) : <PublicCatalog />;
}

export default App;

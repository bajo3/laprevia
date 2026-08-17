import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import CategoryNav from "./components/CategoryNav";
import ProductGrid from "./components/ProductGrid";
import { SearchBar } from "./components/SearchBar";
import { CartDrawer } from "./components/CartDrawer";
import InfoTicket from "./components/InfoTicket";
import Footer from "./components/Footer";
import { categories } from "./data/catalog-config";
import { fetchBundledCatalog, fetchCatalogProducts } from "./data/catalog-api";
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
    .replace(/[\u0300-\u036f]/g, "");

function PublicCatalog() {
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(48);

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      try {
        const remoteProducts = await fetchCatalogProducts();
        const products = remoteProducts.length > 0 ? remoteProducts : await fetchBundledCatalog();
        if (!cancelled) setCatalogProducts(products);
      } catch {
        try {
          const products = await fetchBundledCatalog();
          if (!cancelled) setCatalogProducts(products);
        } catch {
          if (!cancelled) setCatalogProducts([]);
        }
      } finally {
        if (!cancelled) setIsCatalogLoading(false);
      }
    }
    void loadCatalog();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim());

    return catalogProducts.filter((product) => {
      const matchesCategory = !activeCategory || product.category === activeCategory;
      const matchesSearch =
        !normalizedQuery ||
        normalizeSearch(product.name).includes(normalizedQuery) ||
        product.id.includes(normalizedQuery) ||
        normalizeSearch(product.code ?? "").includes(normalizedQuery);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, catalogProducts, query]);

  useEffect(() => setVisibleCount(48), [activeCategory, query]);

  const visibleProducts = filtered.slice(0, visibleCount);

  const cartLines = useMemo(
    () =>
      catalogProducts
        .filter((product) => (cart[product.id] ?? 0) > 0)
        .map((product) => ({ product, quantity: cart[product.id] })),
    [cart, catalogProducts],
  );

  const cartCount = useMemo(
    () => Object.values(cart).reduce((sum, quantity) => sum + quantity, 0),
    [cart],
  );

  const cartTotal = useMemo(
    () =>
      cartLines.reduce(
        (sum, line) => sum + line.product.price * line.quantity,
        0,
      ),
    [cartLines],
  );

  const changeQuantity = useCallback((product: Product, delta: number) => {
    setCart((current) => {
      const currentQuantity = current[product.id] ?? 0;
      // No stock ceiling: the catalog does not publish stock, so silently
      // refusing to increment would be unexplainable to the shopper. The shop
      // confirms availability when the WhatsApp order arrives.
      const nextQuantity = Math.max(0, currentQuantity + delta);

      if (nextQuantity === 0) {
        const nextCart = { ...current };
        delete nextCart[product.id];
        return nextCart;
      }

      return { ...current, [product.id]: nextQuantity };
    });
  }, []);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const clearCart = useCallback(() => setCart({}), []);

  return (
    <>
      <Header cartCount={cartCount} onCartOpen={openCart} />
      <Hero />

      <p className="mx-auto mt-6 mb-2 max-w-2xl px-5 text-center text-sm text-ink/60 sm:mt-10 sm:rounded-2xl sm:border-2 sm:border-dashed sm:border-ink/30 sm:py-3">
        🧾 Armá tu pedido y envialo por WhatsApp. El total es estimado y se confirma al responderte.
      </p>

      <SearchBar query={query} resultCount={filtered.length} onQueryChange={setQuery} />
      <CategoryNav categories={categories} active={activeCategory} onSelect={setActiveCategory} />
      {isCatalogLoading ? (
        <div className="mx-auto max-w-2xl px-5 py-16 text-center" role="status">
          <p className="font-display text-3xl">Cargando catálogo…</p>
          <p className="mt-2 text-sm font-semibold text-ink/50">Estamos preparando los productos para vos.</p>
        </div>
      ) : (
        <ProductGrid
          products={visibleProducts}
          categories={categories}
          quantities={cart}
          onChangeQuantity={changeQuantity}
          hasMore={visibleCount < filtered.length}
          totalCount={filtered.length}
          onLoadMore={() => setVisibleCount((current) => current + 48)}
        />
      )}
      <InfoTicket />
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

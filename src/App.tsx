import { useCallback, useMemo, useState } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import CategoryNav from "./components/CategoryNav";
import ProductGrid from "./components/ProductGrid";
import { SearchBar } from "./components/SearchBar";
import { CartDrawer } from "./components/CartDrawer";
import InfoTicket from "./components/InfoTicket";
import Footer from "./components/Footer";
import { categories, products, type Product } from "./data/products";

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

function App() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim());

    return products.filter((product) => {
      const matchesCategory = !activeCategory || product.category === activeCategory;
      const matchesSearch =
        !normalizedQuery ||
        normalizeSearch(product.name).includes(normalizedQuery) ||
        product.id.includes(normalizedQuery);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, query]);

  const cartLines = useMemo(
    () =>
      products
        .filter((product) => (cart[product.id] ?? 0) > 0)
        .map((product) => ({ product, quantity: cart[product.id] })),
    [cart],
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
      const maximum = product.stock ?? Number.POSITIVE_INFINITY;
      const nextQuantity = Math.max(0, Math.min(maximum, currentQuantity + delta));

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
      <ProductGrid
        products={filtered}
        categories={categories}
        quantities={cart}
        onChangeQuantity={changeQuantity}
      />
      <InfoTicket />
      <Footer />

      {cartCount > 0 && (
        <button
          type="button"
          onClick={openCart}
          className="fixed bottom-5 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between rounded-full border-[3px] border-ink bg-yellow px-5 py-3 text-ink shadow-[5px_5px_0_var(--color-ink)] transition hover:-translate-y-1 hover:shadow-[7px_7px_0_var(--color-ink)] sm:left-auto sm:right-6 sm:w-auto sm:translate-x-0"
          aria-label={`Abrir carrito con ${cartCount} unidades`}
        >
          <span className="font-extrabold">🛒 Ver carrito · {cartCount}</span>
          <span className="ml-5 font-display text-xl">{currency.format(cartTotal)}</span>
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

export default App;

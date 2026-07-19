import { useMemo, useState } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import CategoryNav from "./components/CategoryNav";
import ProductGrid from "./components/ProductGrid";
import InfoTicket from "./components/InfoTicket";
import Footer from "./components/Footer";
import WhatsAppFab from "./components/WhatsAppFab";
import { categories, products } from "./data/products";

function App() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = useMemo(
    () => (activeCategory ? products.filter((p) => p.category === activeCategory) : products),
    [activeCategory]
  );

  return (
    <>
      <Header />
      <Hero />

      <p className="mx-auto mt-10 max-w-2xl rounded-2xl border-2 border-dashed border-ink/30 px-5 py-3 text-center text-sm text-ink/60">
        🚧 Catálogo en carga — los precios se actualizan cada vez que se reimporta la planilla de Codelector.
      </p>

      <CategoryNav categories={categories} active={activeCategory} onSelect={setActiveCategory} />
      <ProductGrid products={filtered} categories={categories} />
      <InfoTicket />
      <Footer />
      <WhatsAppFab />
    </>
  );
}

export default App;

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-navy pb-20 pt-12 text-cream sm:pb-24 sm:pt-16">
      <div className="pointer-events-none absolute inset-0 text-cream/10 confetti-bg" />

      <span className="animate-float absolute left-[6%] top-16 text-5xl [--rot:-8deg] sm:text-6xl">🎈</span>
      <span className="animate-float absolute right-[8%] top-28 text-4xl [--rot:10deg] sm:text-5xl" style={{ animationDelay: "1.2s" }}>🍭</span>
      <span className="animate-float absolute bottom-10 left-[14%] text-4xl [--rot:6deg] sm:text-5xl" style={{ animationDelay: "2.4s" }}>🍦</span>
      <span className="animate-float absolute bottom-16 right-[16%] text-5xl [--rot:-6deg] sm:text-6xl" style={{ animationDelay: "0.6s" }}>🎊</span>

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-5 text-center">
        <span className="rounded-full border-2 border-yellow bg-yellow/10 px-4 py-1 text-xs font-extrabold uppercase tracking-[0.2em] text-yellow">
          Tandil · 5.9k siguiéndonos en Instagram
        </span>

        <h1 className="font-display mt-6 text-5xl leading-[0.95] sm:text-7xl md:text-8xl">
          <span className="block">Cotillón, snacks</span>
          <span className="block text-pink text-outline">y de todo un poco</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg text-cream/80 sm:text-xl">
          Distribuidora mayorista y minorista de cotillón, golosinas, helados,
          snacks y productos importados. Todo lo que necesitás para tu fiesta
          o tu kiosco, en un solo lugar.
        </p>

        <div className="mt-9 flex flex-col gap-4 sm:flex-row">
          <a
            href="#catalogo"
            className="rounded-full bg-pink px-8 py-4 font-display text-xl text-white shadow-[5px_5px_0_var(--color-yellow)] transition hover:-translate-y-1 hover:shadow-[7px_7px_0_var(--color-yellow)]"
          >
            Ver catálogo
          </a>
          <a
            href="https://wa.me/c/5492494009317"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border-2 border-cream/40 px-8 py-4 font-display text-xl text-cream transition hover:border-teal hover:text-teal"
          >
            Pedir por WhatsApp
          </a>
        </div>
      </div>

      <div className="absolute -bottom-1 left-0 h-9 w-full scallop-edge bg-cream" />
    </section>
  );
}

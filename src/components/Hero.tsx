import { WHATSAPP_CATALOG_URL } from "../data/site-config";

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-navy pb-16 pt-10 text-cream sm:pb-24 sm:pt-16">
      <div className="pointer-events-none absolute inset-0 text-cream/10 confetti-bg" />

      {/* Decorative floats only appear from lg up. Below that they physically
          overlap the headline and the two CTAs (verified at 375px and 735px). */}
      <span aria-hidden="true" className="animate-float absolute left-[4%] top-16 hidden text-6xl [--rot:-8deg] lg:block">🎈</span>
      <span aria-hidden="true" className="animate-float absolute right-[5%] top-28 hidden text-5xl [--rot:10deg] lg:block" style={{ animationDelay: "1.2s" }}>🍭</span>
      <span aria-hidden="true" className="animate-float absolute bottom-10 left-[8%] hidden text-5xl [--rot:6deg] lg:block" style={{ animationDelay: "2.4s" }}>🍦</span>
      <span aria-hidden="true" className="animate-float absolute bottom-16 right-[9%] hidden text-6xl [--rot:-6deg] lg:block" style={{ animationDelay: "0.6s" }}>🎊</span>

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-5 text-center">
        <span className="rounded-full border-2 border-yellow bg-yellow/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-yellow sm:px-4 sm:text-xs sm:tracking-[0.2em]">
          Tandil · 5.9k siguiéndonos en Instagram
        </span>

        <h1 className="font-display mt-5 text-[2.6rem] leading-[0.95] sm:mt-6 sm:text-7xl md:text-8xl">
          <span className="block">Cotillón, snacks</span>
          <span className="block text-pink text-outline">y de todo un poco</span>
        </h1>

        <p className="mt-5 max-w-xl text-base text-cream/80 sm:mt-6 sm:text-xl">
          Distribuidora mayorista y minorista de cotillón, golosinas, helados,
          snacks y productos importados. Todo lo que necesitás para tu fiesta
          o tu kiosco, en un solo lugar.
        </p>

        <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:mt-9 sm:w-auto sm:max-w-none sm:flex-row sm:gap-4">
          <a
            href="#catalogo"
            className="rounded-full bg-pink px-8 py-4 font-display text-xl text-white shadow-[5px_5px_0_var(--color-yellow)] transition hover:-translate-y-1 hover:shadow-[7px_7px_0_var(--color-yellow)]"
          >
            Ver catálogo
          </a>
          <a
            href={WHATSAPP_CATALOG_URL}
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

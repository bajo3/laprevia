type FooterProps = {
  /** Adds room at the bottom so the floating cart bar never covers the credits. */
  hasFloatingBar?: boolean;
};

export default function Footer({ hasFloatingBar = false }: FooterProps) {
  return (
    <footer
      className={`relative bg-navy px-5 pt-10 text-center text-cream/70 ${
        hasFloatingBar ? "pb-32 sm:pb-10" : "pb-10"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 text-cream/5 confetti-bg" />
      <p className="relative font-display text-2xl text-cream">La Previa</p>
      <p className="relative mt-1 text-sm">Distribuidora de cotillón, snacks e importados · Tandil</p>
      <p className="relative mt-4 text-xs text-cream/40">
        © {new Date().getFullYear()} Distribuidora La Previa. Catálogo online de la distribuidora.
      </p>
    </footer>
  );
}

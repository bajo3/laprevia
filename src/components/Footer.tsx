export default function Footer() {
  return (
    <footer className="relative bg-navy py-10 text-center text-cream/70">
      <div className="pointer-events-none absolute inset-0 text-cream/5 confetti-bg" />
      <p className="relative font-display text-2xl text-cream">La Previa</p>
      <p className="relative mt-1 text-sm">Distribuidora de cotillón, snacks e importados · Tandil</p>
      <p className="relative mt-4 text-xs text-cream/40">
        © {new Date().getFullYear()} Distribuidora La Previa. Catálogo web no oficial de la marca.
      </p>
    </footer>
  );
}

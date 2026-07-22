type SearchBarProps = {
  query: string;
  resultCount: number;
  onQueryChange: (query: string) => void;
};

export function SearchBar({ query, resultCount, onQueryChange }: SearchBarProps) {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-5 pt-2 sm:pb-8">
      <div className="relative mx-auto max-w-2xl">
        <label htmlFor="product-search" className="sr-only">
          Buscar productos
        </label>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-xl"
        >
          🔎
        </span>
        <input
          id="product-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Buscar globos, snacks, chocolates..."
          className="w-full rounded-full border-[3px] border-ink bg-white py-4 pl-14 pr-28 font-semibold text-ink shadow-[4px_4px_0_var(--color-ink)] outline-none transition placeholder:text-ink/35 focus:-translate-y-0.5 focus:ring-4 focus:ring-pink/25"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-cream-dark px-3 py-1.5 text-xs font-extrabold uppercase text-ink transition hover:bg-pink hover:text-white"
          >
            Limpiar
          </button>
        )}
      </div>
      <p className="mt-3 text-center text-sm font-bold text-ink/50" aria-live="polite">
        {resultCount} {resultCount === 1 ? "producto encontrado" : "productos encontrados"}
      </p>
    </div>
  );
}

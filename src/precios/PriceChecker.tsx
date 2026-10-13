import { useCallback, useEffect, useRef, useState } from "react";
import type { Product } from "../data/products";
import { fetchCatalogPage } from "../data/catalog-api";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** How long to wait after the last key before searching by name. A scanner
 *  never gets here: it types the whole code in a few milliseconds and sends
 *  Enter, which searches at once. */
const TYPING_DELAY = 350;
const MAX_RESULTS = 24;

type Result =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; products: Product[]; total: number; term: string }
  | { status: "empty"; term: string }
  | { status: "error" };

/** The exact code first, the name second.
 *
 *  Both go out together: the code lookup is an index hit and almost always
 *  what a scan wants, and waiting for it to miss before asking by name would
 *  make every typed word pay two round trips in a row. */
async function lookUp(term: string): Promise<{ products: Product[]; total: number }> {
  const isOneWord = !/\s/.test(term);
  const [byCode, byName] = await Promise.all([
    isOneWord ? fetchCatalogPage({ code: term, limit: MAX_RESULTS }) : null,
    fetchCatalogPage({ query: term, limit: MAX_RESULTS }),
  ]);
  // Kept only if the code really is this one: an answer that ignored the
  // filter would otherwise pass off the top of the catalog as a match.
  const wanted = term.replace(/^0+/, "").toLowerCase();
  const exact = (byCode?.products ?? []).filter(
    (product) => (product.code ?? "").replace(/^0+/, "").toLowerCase() === wanted,
  );
  if (exact.length) return { products: exact, total: exact.length };
  return byName;
}

function ProductPhoto({ product, className }: { product: Product; className: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.image]);

  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-ink bg-cream-dark ${className}`}>
      {product.image && !failed ? (
        <img src={product.image} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden="true">{product.emoji}</span>
      )}
    </div>
  );
}

export default function PriceChecker() {
  const [term, setTerm] = useState("");
  const [result, setResult] = useState<Result>({ status: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  /** Only the answer to the latest search may land: a slow reply to the
   *  previous scan must not overwrite the product on screen. */
  const latestSearch = useRef(0);
  /** What is already on screen. A scan searches on Enter, and the typing
   *  timer it left behind must not run the same search again a moment later. */
  const searchedTerm = useRef("");

  const search = useCallback(async (rawTerm: string) => {
    const wanted = rawTerm.trim();
    const ticket = ++latestSearch.current;
    searchedTerm.current = wanted;
    if (!wanted) {
      setResult({ status: "idle" });
      return;
    }
    setResult({ status: "loading" });
    try {
      const { products, total } = await lookUp(wanted);
      if (ticket !== latestSearch.current) return;
      setResult(products.length ? { status: "found", products, total, term: wanted } : { status: "empty", term: wanted });
    } catch {
      if (ticket === latestSearch.current) setResult({ status: "error" });
    }
  }, []);

  useEffect(() => {
    document.title = "Consultor de precios · La Previa";
  }, []);

  // Typing a name searches on its own after a pause.
  useEffect(() => {
    if (term.trim().length < 2 || term.trim() === searchedTerm.current) return;
    const timer = window.setTimeout(() => search(term), TYPING_DELAY);
    return () => window.clearTimeout(timer);
  }, [term, search]);

  // A scanner types wherever the focus happens to be. After someone taps the
  // screen the box has lost it, and the next scan would go nowhere — so any
  // key pressed outside the box is sent back into it.
  useEffect(() => {
    function sendKeysToInput(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (document.activeElement !== inputRef.current) inputRef.current?.focus();
    }
    document.addEventListener("keydown", sendKeysToInput);
    return () => document.removeEventListener("keydown", sendKeysToInput);
  }, []);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    search(term);
    // Selected, so the next scan replaces this one instead of being glued to
    // the end of it.
    inputRef.current?.select();
  }

  function clear() {
    latestSearch.current += 1;
    searchedTerm.current = "";
    setTerm("");
    setResult({ status: "idle" });
    inputRef.current?.focus();
  }

  const single = result.status === "found" && result.products.length === 1 ? result.products[0] : null;

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="border-b-4 border-ink bg-navy px-5 py-4 text-cream">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <h1 className="font-display text-2xl sm:text-3xl">Consultor de precios</h1>
          <span className="text-sm font-bold text-cream/70">La Previa</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-6 sm:py-10">
        <form onSubmit={handleSubmit} className="relative">
          <label htmlFor="price-search" className="sr-only">
            Código de barras o nombre del producto
          </label>
          <input
            id="price-search"
            ref={inputRef}
            type="text"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Escaneá el código o escribí el nombre"
            autoFocus
            // The box is the only thing on this screen worth typing into, so it
            // takes the focus back as soon as a tap elsewhere removes it.
            onBlur={() => window.setTimeout(() => inputRef.current?.focus(), 0)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
            className={`w-full rounded-full border-[3px] border-ink bg-white py-5 pl-7 text-xl font-bold text-ink shadow-[4px_4px_0_var(--color-ink)] outline-none transition placeholder:font-semibold placeholder:text-ink/35 focus-visible:ring-4 focus-visible:ring-pink/40 sm:text-2xl ${
              term ? "pr-32" : "pr-7"
            }`}
          />
          {term && (
            <button
              type="button"
              onClick={clear}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-cream-dark px-4 py-2 text-sm font-extrabold uppercase text-ink transition hover:bg-pink hover:text-white"
            >
              Limpiar
            </button>
          )}
        </form>

        <div className="mt-8" aria-live="polite">
          {result.status === "idle" && (
            <p className="py-16 text-center text-lg font-bold text-ink/45">
              Pasá el producto por el lector para ver el precio.
            </p>
          )}

          {result.status === "loading" && (
            <p className="py-16 text-center font-display text-3xl text-ink/50">Buscando…</p>
          )}

          {result.status === "error" && (
            <p className="rounded-3xl border-[3px] border-ink bg-white p-8 text-center text-lg font-bold shadow-[4px_4px_0_var(--color-ink)]">
              No se pudo consultar el precio. Revisá la conexión y probá de nuevo.
            </p>
          )}

          {result.status === "empty" && (
            <div className="rounded-3xl border-[3px] border-ink bg-white p-8 text-center shadow-[4px_4px_0_var(--color-ink)]">
              <p className="font-display text-3xl">No lo encontramos</p>
              <p className="mt-2 break-all text-lg font-bold text-ink/60">“{result.term}”</p>
              <p className="mt-3 text-sm font-semibold text-ink/50">
                Probá escribiendo parte del nombre del producto.
              </p>
            </div>
          )}

          {single && (
            <article className="flex flex-col items-center gap-6 rounded-3xl border-[3px] border-ink bg-white p-6 shadow-[6px_6px_0_var(--color-ink)] sm:flex-row sm:items-stretch sm:p-8">
              <ProductPhoto product={single} className="h-48 w-48 text-7xl sm:h-64 sm:w-64" />
              <div className="flex min-w-0 flex-1 flex-col justify-center text-center sm:text-left">
                <h2 className="font-display text-2xl leading-tight sm:text-4xl">{single.name}</h2>
                <p className="mt-4 font-display text-6xl text-pink tabular-nums sm:text-8xl">
                  {currency.format(single.price)}
                </p>
                {single.code && (
                  <p className="mt-4 break-all text-sm font-bold text-ink/45">Código {single.code}</p>
                )}
              </div>
            </article>
          )}

          {result.status === "found" && !single && (
            <>
              <p className="mb-3 text-sm font-bold text-ink/50">
                {result.total > result.products.length
                  ? `${result.products.length} de ${result.total.toLocaleString("es-AR")} productos. Escribí más para afinar.`
                  : `${result.products.length} productos`}
              </p>
              <ul className="space-y-3">
                {result.products.map((product) => (
                  <li
                    key={product.id}
                    className="flex items-center gap-4 rounded-2xl border-[3px] border-ink bg-white p-3 shadow-[3px_3px_0_var(--color-ink)]"
                  >
                    <ProductPhoto product={product} className="h-16 w-16 text-3xl" />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg leading-tight sm:text-xl">{product.name}</p>
                      {product.code && (
                        <p className="mt-0.5 truncate text-xs font-bold text-ink/45">Código {product.code}</p>
                      )}
                    </div>
                    <p className="shrink-0 font-display text-2xl text-pink tabular-nums sm:text-3xl">
                      {currency.format(product.price)}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

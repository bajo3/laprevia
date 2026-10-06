import type { Category } from "../data/products";

type Props = {
  categories: Category[];
  active: string | null;
  onSelect: (slug: string | null) => void;
  favoriteCount: number;
  isShowingFavorites: boolean;
  onSelectFavorites: () => void;
};

export default function CategoryNav({
  categories,
  active,
  onSelect,
  favoriteCount,
  isShowingFavorites,
  onSelectFavorites,
}: Props) {
  return (
    <nav
      id="categorias"
      aria-label="Categorías"
      className="sticky top-16 z-40 border-y-[3px] border-ink bg-cream/95 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:backdrop-blur-none"
    >
      {/* scroll-pl-5 keeps snap alignment inside the padding box — without it the
          rail settles at scrollLeft 20 and clips the first chip's left border. */}
      <div className="hide-scrollbar mx-auto flex max-w-6xl snap-x scroll-pl-5 gap-2.5 overflow-x-auto px-5 py-3 sm:flex-wrap sm:justify-center sm:overflow-visible sm:py-10">
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-pressed={active === null && !isShowingFavorites}
          className={`shrink-0 snap-start rounded-full border-[3px] border-ink px-4 py-2 font-display text-base transition sm:px-5 sm:text-lg ${
            active === null && !isShowingFavorites
              ? "bg-ink text-cream"
              : "bg-cream text-ink hover:-translate-y-0.5"
          }`}
        >
          ✨ Todo
        </button>
        {/* Second on the rail, ahead of the sections: on a phone the rail
            scrolls sideways and only the first two or three chips are on
            screen, so anywhere further along nobody would find it. */}
        <button
          type="button"
          onClick={onSelectFavorites}
          aria-pressed={isShowingFavorites}
          className={`shrink-0 snap-start rounded-full border-[3px] border-ink px-4 py-2 font-display text-base transition hover:-translate-y-0.5 sm:px-5 sm:text-lg ${
            isShowingFavorites ? "bg-pink text-white" : "bg-white text-ink"
          }`}
        >
          <span aria-hidden="true">❤️ </span>
          Favoritos
          {favoriteCount > 0 && (
            <span className="tabular-nums"> · {favoriteCount.toLocaleString("es-AR")}</span>
          )}
        </button>
        {categories.map((cat) => (
          <button
            key={cat.slug}
            type="button"
            onClick={() => onSelect(cat.slug)}
            aria-pressed={active === cat.slug}
            style={active === cat.slug ? { backgroundColor: cat.color } : undefined}
            className={`shrink-0 snap-start rounded-full border-[3px] border-ink px-4 py-2 font-display text-base transition hover:-translate-y-0.5 sm:px-5 sm:text-lg ${
              active === cat.slug ? "text-white" : "bg-white text-ink"
            }`}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

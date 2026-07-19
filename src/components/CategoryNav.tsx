import type { Category } from "../data/products";

type Props = {
  categories: Category[];
  active: string | null;
  onSelect: (slug: string | null) => void;
};

export default function CategoryNav({ categories, active, onSelect }: Props) {
  return (
    <div id="categorias" className="mx-auto flex max-w-6xl flex-wrap justify-center gap-3 px-5 py-10">
      <button
        onClick={() => onSelect(null)}
        className={`rounded-full border-[3px] border-ink px-5 py-2 font-display text-lg transition ${
          active === null
            ? "bg-ink text-cream"
            : "bg-cream text-ink hover:-translate-y-0.5"
        }`}
      >
        ✨ Todo
      </button>
      {categories.map((cat) => (
        <button
          key={cat.slug}
          onClick={() => onSelect(cat.slug)}
          style={active === cat.slug ? { backgroundColor: cat.color } : undefined}
          className={`rounded-full border-[3px] border-ink px-5 py-2 font-display text-lg transition hover:-translate-y-0.5 ${
            active === cat.slug ? "text-white" : "bg-white text-ink"
          }`}
        >
          {cat.emoji} {cat.label}
        </button>
      ))}
    </div>
  );
}

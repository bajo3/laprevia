import { useState } from "react";
import { CATEGORY_COLORS, FALLBACK_SLUG } from "../data/catalog-config";
import {
  createCategory,
  deleteCategory,
  reorderCategories,
  updateCategory,
} from "../data/catalog-api";
import type { Category } from "../data/products";

type Notice = { tone: "success" | "warning" | "error"; text: string };

type Props = {
  categories: Category[];
  /** False when the server is still answering with the built-in list, because
   *  the database or its `categories` table is not there. Every edit would be
   *  refused, so the panel explains instead of pretending. */
  isEditable: boolean;
  counts: Record<string, number>;
  token: string | null;
  onNotice: (notice: Notice) => void;
  /** The catalog on screen may now be showing a section that was renamed or
   *  deleted, so the dashboard reloads its page and its counts. */
  onChanged: () => void;
  onUnauthorized: () => void;
};

type Draft = { label: string; emoji: string; color: string };

const NEW_SECTION: Draft = { label: "", emoji: "🏷️", color: "var(--color-pink)" };

function isUnauthorized(error: unknown) {
  return typeof error === "object" && error !== null && (error as { status?: number }).status === 401;
}

function message(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Shared by the rows and the new-section form: emoji, name and colour, in the
 *  order they read on the chip the shopper ends up tapping.
 *
 *  Emoji and name are one group that takes a whole line on a narrow screen.
 *  Letting all three share a wrapping row instead squeezed the name — the one
 *  field that actually matters — down to a sliver between the emoji box and
 *  the colour dropdown. */
function DraftFields({
  draft,
  disabled,
  onChange,
}: {
  draft: Draft;
  disabled: boolean;
  onChange: (next: Draft) => void;
}) {
  return (
    <>
      <div className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-64">
        <label className="shrink-0">
          <span className="sr-only">Emoji</span>
          <input
            value={draft.emoji}
            disabled={disabled}
            maxLength={8}
            onChange={(event) => onChange({ ...draft, emoji: event.target.value })}
            className="w-14 rounded-2xl border-2 border-ink bg-white px-2 py-2.5 text-center text-lg outline-none focus:ring-4 focus:ring-pink/20 disabled:opacity-50"
          />
        </label>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Nombre de la sección</span>
          <input
            value={draft.label}
            disabled={disabled}
            maxLength={30}
            placeholder="Nombre de la sección"
            onChange={(event) => onChange({ ...draft, label: event.target.value })}
            className="w-full rounded-2xl border-2 border-ink bg-white px-3 py-2.5 font-extrabold outline-none focus:ring-4 focus:ring-pink/20 disabled:opacity-50"
          />
        </label>
      </div>
      <label className="shrink-0">
        <span className="sr-only">Color</span>
        <select
          value={draft.color}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, color: event.target.value })}
          className="rounded-2xl border-2 border-ink bg-white px-3 py-2.5 text-sm font-extrabold outline-none focus:ring-4 focus:ring-pink/20 disabled:opacity-50"
          style={{ borderColor: draft.color }}
        >
          {CATEGORY_COLORS.map((color) => (
            <option key={color.value} value={color.value}>
              {color.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

export default function SectionManager({
  categories,
  isEditable,
  counts,
  token,
  onNotice,
  onChanged,
  onUnauthorized,
}: Props) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [confirmingSlug, setConfirmingSlug] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<string>(FALLBACK_SLUG);
  const [newSection, setNewSection] = useState<Draft>(NEW_SECTION);
  const [isCreating, setIsCreating] = useState(false);

  // "Varios" is the drawer a deleted section empties into, so it cannot be
  // deleted or moved out of last place. It can still be renamed.
  const movable = categories.filter((category) => !category.protected);
  const pinned = categories.filter((category) => category.protected);

  function draftFor(category: Category): Draft {
    return drafts[category.slug] ?? { label: category.label, emoji: category.emoji, color: category.color };
  }

  function isDirty(category: Category) {
    const draft = drafts[category.slug];
    if (!draft) return false;
    return draft.label !== category.label || draft.emoji !== category.emoji || draft.color !== category.color;
  }

  function setDraft(slug: string, next: Draft) {
    setDrafts((current) => ({ ...current, [slug]: next }));
  }

  function clearDraft(slug: string) {
    setDrafts((current) => {
      const next = { ...current };
      delete next[slug];
      return next;
    });
  }

  /** Every write goes through here so the failure handling — an expired
   *  session in particular — is the same wherever it is triggered from. */
  async function run(slug: string, action: () => Promise<void>) {
    setBusySlug(slug);
    try {
      await action();
    } catch (error) {
      if (isUnauthorized(error)) {
        onUnauthorized();
        return;
      }
      onNotice({ tone: "error", text: message(error, "No se pudo guardar el cambio.") });
    } finally {
      setBusySlug(null);
    }
  }

  async function saveSection(category: Category) {
    const draft = draftFor(category);
    if (!draft.label.trim()) {
      onNotice({ tone: "error", text: "La sección necesita un nombre." });
      return;
    }
    await run(category.slug, async () => {
      await updateCategory({ slug: category.slug, ...draft, label: draft.label.trim() }, token);
      clearDraft(category.slug);
      onNotice({ tone: "success", text: `Sección guardada como "${draft.label.trim()}".` });
      onChanged();
    });
  }

  async function move(category: Category, direction: -1 | 1) {
    const index = movable.findIndex((item) => item.slug === category.slug);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= movable.length) return;
    const reordered = [...movable];
    reordered[index] = movable[target];
    reordered[target] = movable[index];
    await run(category.slug, async () => {
      await reorderCategories([...reordered, ...pinned].map((item) => item.slug), token);
    });
  }

  async function confirmDelete(category: Category) {
    await run(category.slug, async () => {
      const { moved } = await deleteCategory(category.slug, moveTo, token);
      const destination = categories.find((item) => item.slug === moveTo);
      setConfirmingSlug(null);
      onNotice({
        tone: "success",
        text: moved
          ? `Se eliminó "${category.label}". Sus ${moved.toLocaleString("es-AR")} productos pasaron a ${destination?.label ?? "Varios"}.`
          : `Se eliminó "${category.label}". No tenía ningún producto.`,
      });
      onChanged();
    });
  }

  async function addSection() {
    const label = newSection.label.trim();
    if (!label) {
      onNotice({ tone: "error", text: "Escribí el nombre de la sección nueva." });
      return;
    }
    setIsCreating(true);
    try {
      await createCategory({ ...newSection, label }, token);
      setNewSection(NEW_SECTION);
      onNotice({ tone: "success", text: `Sección "${label}" creada. Ya podés mandarle productos.` });
      onChanged();
    } catch (error) {
      if (isUnauthorized(error)) {
        onUnauthorized();
        return;
      }
      onNotice({ tone: "error", text: message(error, "No se pudo crear la sección.") });
    } finally {
      setIsCreating(false);
    }
  }

  function renderRow(category: Category, index: number) {
    const draft = draftFor(category);
    const busy = busySlug === category.slug;
    const count = counts[category.slug] ?? 0;
    const isConfirming = confirmingSlug === category.slug;

    return (
      <li key={category.slug} className="rounded-2xl border-2 border-ink bg-cream p-3">
        <div className="flex flex-wrap items-center gap-2">
          <DraftFields
            draft={draft}
            disabled={busy || !isEditable}
            onChange={(next) => setDraft(category.slug, next)}
          />
          <span className="shrink-0 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-xs font-extrabold">
            {count.toLocaleString("es-AR")} prod.
          </span>
          {!category.protected && (
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => void move(category, -1)}
                disabled={busy || index === 0 || !isEditable}
                aria-label={`Subir ${category.label}`}
                className="h-10 w-10 rounded-full border-2 border-ink bg-white font-black transition hover:bg-yellow disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => void move(category, 1)}
                disabled={busy || index === movable.length - 1 || !isEditable}
                aria-label={`Bajar ${category.label}`}
                className="h-10 w-10 rounded-full border-2 border-ink bg-white font-black transition hover:bg-yellow disabled:opacity-30"
              >
                ↓
              </button>
            </div>
          )}
          {isDirty(category) && (
            <button
              type="button"
              onClick={() => void saveSection(category)}
              disabled={busy}
              className="shrink-0 rounded-full border-2 border-ink bg-teal px-4 py-2.5 text-sm font-extrabold text-white shadow-[3px_3px_0_var(--color-ink)] disabled:opacity-50"
            >
              {busy ? "Guardando…" : "Guardar"}
            </button>
          )}
          {category.protected ? (
            <span className="shrink-0 rounded-full border-2 border-dashed border-ink/40 px-3 py-1.5 text-xs font-extrabold text-ink/55">
              Cajón general
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setConfirmingSlug(isConfirming ? null : category.slug);
                setMoveTo(FALLBACK_SLUG);
              }}
              disabled={busy || !isEditable}
              className="shrink-0 rounded-full border-2 border-ink bg-white px-4 py-2.5 text-sm font-extrabold transition hover:bg-pink hover:text-white disabled:opacity-40"
            >
              {isConfirming ? "Cancelar" : "Eliminar"}
            </button>
          )}
        </div>

        {/* Deleting a section never deletes products, and the panel says where
            they are going before it happens rather than after. */}
        {isConfirming && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-pink bg-pink/10 p-3">
            {/* No number here on purpose. The chip above counts active
                products, and the delete moves the deactivated ones too — every
                article dropped from a past price list — so a count promised
                here would not match the one the server reports back. */}
            <p className="w-full text-sm font-bold sm:w-auto">
              {count > 0
                ? "Sus productos pasan a:"
                : "No tiene productos activos. Se elimina la sección y lo que tenga dado de baja pasa a:"}
            </p>
            <label>
              <span className="sr-only">Sección de destino</span>
              <select
                value={moveTo}
                onChange={(event) => setMoveTo(event.target.value)}
                className="rounded-full border-2 border-ink bg-white px-3 py-2 text-sm font-extrabold outline-none focus:ring-4 focus:ring-pink/20"
              >
                {categories
                  .filter((item) => item.slug !== category.slug)
                  .map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.emoji} {item.label}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void confirmDelete(category)}
              disabled={busy}
              className="rounded-full border-2 border-ink bg-pink px-4 py-2 text-sm font-extrabold text-white shadow-[3px_3px_0_var(--color-ink)] disabled:opacity-50"
            >
              {busy ? "Eliminando…" : "Eliminar sección"}
            </button>
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="mt-5 rounded-2xl border-2 border-dashed border-ink/30 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl">Administrar secciones</h3>
        <p className="text-sm text-ink/60">
          Cambiá nombre, emoji, color y orden. El orden es el de los botones del catálogo.
        </p>
      </div>

      {!isEditable && (
        <p className="mt-3 rounded-2xl border-2 border-ink bg-yellow/30 px-4 py-3 text-sm font-bold" role="status">
          Las secciones se están leyendo de la copia que trae el sitio, no de la base. Hasta que se
          corra <code className="font-mono">db/migrations/0004_categories_table.sql</code> no se pueden
          editar desde acá.
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {movable.map((category, index) => renderRow(category, index))}
        {pinned.map((category) => renderRow(category, movable.length))}
      </ul>

      <div className="mt-4 rounded-2xl border-2 border-ink bg-cream-dark p-3">
        <p className="text-xs font-extrabold uppercase tracking-wider text-ink/55">Nueva sección</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <DraftFields draft={newSection} disabled={isCreating || !isEditable} onChange={setNewSection} />
          <button
            type="button"
            onClick={() => void addSection()}
            disabled={isCreating || !isEditable}
            className="shrink-0 rounded-full border-[3px] border-ink bg-yellow px-5 py-2.5 font-extrabold shadow-[3px_3px_0_var(--color-ink)] transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            {isCreating ? "Creando…" : "＋ Agregar sección"}
          </button>
        </div>
        <p className="mt-2 text-sm text-ink/55">
          La sección nace vacía: mandale productos con el desplegable de cada tarjeta o tildando varios.
        </p>
      </div>
    </div>
  );
}

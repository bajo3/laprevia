import { useCallback, useEffect, useMemo, useState } from "react";

const FAVORITES_KEY = "laprevia-favoritos";

/** The favourites view asks the server for these ids in one request, and they
 *  travel in the URL. Two hundred seven-digit ids is about 2 KB of query
 *  string, comfortably inside what every proxy accepts; past that the oldest
 *  favourite makes room for the newest. */
export const MAX_FAVORITES = 200;

/** Only the ids are stored, never a copy of the product. The cart keeps
 *  snapshots because an order is a short-lived thing with an expiry; a
 *  favourite is meant to last months, and a price saved in March would still
 *  be on screen in August. The view reads the products fresh every time. */
function readStoredFavorites(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const ids = parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
    return [...new Set(ids)].slice(-MAX_FAVORITES);
  } catch {
    // A private window, cleared storage or a half-written value: start empty
    // rather than break the catalog over a convenience feature.
    return [];
  }
}

/**
 * The shopper's favourites, kept on their own device.
 *
 * The catalog has no accounts — an order is a WhatsApp message — so there is
 * nobody to attach a favourite to on the server. They live in localStorage,
 * which means they follow the browser, not the person: marked on the phone,
 * they will not show up on the computer.
 */
export function useFavorites() {
  /** Oldest first, so trimming to the cap drops what was marked longest ago. */
  const [ids, setIds] = useState<string[]>(readStoredFavorites);

  useEffect(() => {
    try {
      if (!ids.length) localStorage.removeItem(FAVORITES_KEY);
      else localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
    } catch {
      // Storage can be unavailable or full; favourites still work in memory.
    }
  }, [ids]);

  /** A second tab of the catalog open on the same device should not show
   *  hearts that disagree with this one. */
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === FAVORITES_KEY || event.key === null) setIds(readStoredFavorites());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const idSet = useMemo(() => new Set(ids), [ids]);

  const toggle = useCallback((id: string) => {
    setIds((current) =>
      current.includes(id)
        ? current.filter((existing) => existing !== id)
        : [...current, id].slice(-MAX_FAVORITES),
    );
  }, []);

  return { ids, idSet, toggle };
}

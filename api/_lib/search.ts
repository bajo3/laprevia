/**
 * Turns what someone types in the search box into PostgREST filters.
 *
 * Three things were wrong with sending the raw text as one `ilike` pattern:
 *
 * 1. Accents. 699 of the 15.152 names carry one ("PIÑATA", "ANTEOJO NAVIDEÑO")
 *    and the rest are typed without ("COTILLON"). A shopper writing "cotillón"
 *    got 0 results out of 255, and one writing "pinata" missed all 70.
 * 2. Word order. The whole phrase travelled as one substring, so "globo rojo"
 *    found nothing while "GLOBO BALL CHROME 5P ROJO X10U" was sitting there.
 * 3. `%` and `_` reached Postgres as LIKE wildcards, so searching "%" returned
 *    the entire catalog. Escaping them with a backslash does not work:
 *    PostgREST strips it while unquoting, and its `ilike` takes no ESCAPE.
 *
 * All three go away by switching from LIKE to a case-insensitive regex
 * (`imatch`, i.e. `~*`): every letter that can carry an accent becomes a class
 * matching both spellings, so matching is accent-blind in both directions;
 * each word becomes its own filter and filters combine with AND, so word order
 * stops mattering; and `%` and `_` are ordinary literals in a regex.
 *
 * No backslash ever reaches the filter. Instead of escaping the characters
 * that PostgREST and the regex engine treat as syntax, every character that is
 * not a letter, a digit, `%` or `_` is treated as a word separator — which is
 * also what a shopper means by it, since "p/piñata" is two words.
 */

/** Both spellings of every letter that varies in Spanish product names. */
const ACCENT_CLASSES: Record<string, string> = {
  a: "[aáàâä]",
  e: "[eéèêë]",
  i: "[iíìîï]",
  o: "[oóòôö]",
  u: "[uúùûü]",
  n: "[nñ]",
  c: "[cç]",
};

/** Strips combining marks, so "PIÑATA" and "cotillón" reduce to plain letters. */
export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Anything that is not a letter, a digit, `%` or `_` splits words.
 *
 *  `%` and `_` stay because they are literals in a regex and carry no meaning
 *  to PostgREST — keeping them is what makes a search for "30%" correctly
 *  return nothing instead of every product whose name contains "30". */
const WORD_SEPARATORS = /[^\p{L}\p{N}%_]+/gu;

/** More words than this and it is a paste, not a search. Each word costs a
 *  scan of the table, so the tail is dropped rather than served slowly. */
const MAX_WORDS = 6;
/** Long enough for any real product name, short enough to bound the regex. */
const MAX_WORD_LENGTH = 40;

export function searchWords(query: string): string[] {
  return stripAccents(query)
    .toLowerCase()
    .replace(WORD_SEPARATORS, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, MAX_WORDS)
    .map((word) => word.slice(0, MAX_WORD_LENGTH));
}

/** One already-unaccented word as a regex that matches either spelling. */
function wordToPattern(word: string): string {
  return word
    .split("")
    .map((character) => ACCENT_CLASSES[character] ?? character)
    .join("");
}

/**
 * One PostgREST `or=(...)` group per word, each matching the name, the id or
 * the code. The caller applies them as separate filters, which PostgREST
 * combines with AND — that is what makes "plastico vaso" find the same rows as
 * "vaso plastico".
 *
 * Values go in unquoted. A quoted value has its backslashes eaten by
 * PostgREST, and the characters it reads as structure inside a group — the
 * comma and the parentheses — cannot appear here, because `searchWords` has
 * already turned every one of them into a word break.
 */
export function searchFilterGroups(query: string): string[] {
  return searchWords(query).map((word) => {
    const pattern = wordToPattern(word);
    return `name.imatch.${pattern},id.imatch.${pattern},code.imatch.${pattern}`;
  });
}

/** The browser-side twin, for the offline fallback catalog. Same rules:
 *  accent-blind, every word has to appear, order irrelevant. */
export function matchesAllWords(haystack: string, query: string): boolean {
  const words = searchWords(query);
  if (!words.length) return true;
  const target = stripAccents(haystack).toLowerCase();
  return words.every((word) => target.includes(word));
}

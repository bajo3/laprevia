import { categories } from "./catalog-config";

/** Where a product lands when nothing else matches. Everything in the catalog
 *  has to belong to some section, and guessing wrong is worse than parking it
 *  here: "Varios" is the drawer the panel is meant to empty over time. */
export const FALLBACK_CATEGORY = "varios";

/** Slugs retired from the catalog, mapped to their replacement. Rows saved
 *  before a rename still carry the old slug, so every read normalizes. */
const LEGACY_SLUGS: Record<string, string> = {
  almacen: FALLBACK_CATEGORY,
};

const KNOWN_SLUGS = new Set(categories.map((category) => category.slug));

export const normalize = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Accepts whatever a row carries and returns a slug the catalog can render.
 *  Unknown and retired slugs collapse to the fallback instead of creating a
 *  ghost section no button can reach. */
export function normalizeCategory(value: unknown): string {
  const slug = normalize(value);
  if (!slug) return FALLBACK_CATEGORY;
  if (LEGACY_SLUGS[slug]) return LEGACY_SLUGS[slug];
  return KNOWN_SLUGS.has(slug) ? slug : FALLBACK_CATEGORY;
}

/** Keyword matching is whole-word, so "molde" does not fire on "moldear" and
 *  "copal" does not fire on "copa larga". Multi-word entries match as a
 *  phrase. Product names are wholesale shorthand ("PIROTIN CONT. X50U"), so
 *  accents and punctuation are stripped before comparing. */
function matches(haystack: string, word: string) {
  return new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(haystack);
}

/** First rule that matches wins, so the order is the priority order. Brands go
 *  first: "BOMBA AROMANZA X4" is a sahumería product and "BOMBA AGUA
 *  SUMERGIBLE" is not, and only the brand tells them apart. */
const CATEGORY_RULES: Array<{ slug: string; words: string[] }> = [
  {
    slug: "sahumerios",
    words: [
      "sahumerio", "sahumerios", "sahumito", "sahumitos", "sahumador",
      "saphirus", "aromanza", "sagrada madre", "darshan", "asoka", "satya",
      "goloka", "copal", "palo santo", "incienso", "inciensos",
      "difusor", "difusores", "diffuser", "home spray", "aromatizante",
      "perfumina", "perfuminas", "citronela", "citronella",
    ],
  },
  {
    slug: "reposteria",
    words: [
      "reposteria", "repostero", "repostera", "reposteros", "confiteria",
      "pirotin", "pirotines", "cortante", "cortantes", "cortador de masa",
      "molde", "moldes", "acetato", "tortera", "torteras", "aro para torta",
      "manga", "mangas", "cupla", "cuplas", "pico repostero", "picos reposteros",
      "espatula", "espatulas", "rodillo", "batidor", "tamiz", "termometro",
      "colorante", "colorantes", "fleibor", "pastelar", "ballina", "lodiser",
      "glase", "fondant", "chantilly", "cobertura", "banio de reposteria",
      "sprinkles", "granas", "grana", "confites comestibles", "comestible",
      "comestibles", "perlas comestibles", "dragea", "drageas",
      "premezcla", "polvo de hornear", "impalpable", "papel manteca",
      "savarin", "pionono", "merengue",
      "cake topper", "cake toppers", "cupcake", "cupcakes", "cup cake",
      "disco carton", "discos carton", "blonda", "blondas",
      "placa huevo", "placas huevo", "huevo de pascua", "huevos de pascua",
      "parpen", "shagcake", "baking",
      "flor de azucar", "flor azucar", "flores de azucar", "azucar impalpable",
    ],
  },
  {
    slug: "descartables",
    words: [
      "descartable", "descartables", "roticera", "tarrina", "tarrinas",
      "pote telgopor", "bandeja telgopor", "vaso telgopor", "plato telgopor",
      "bandeja termica", "bandeja termico", "envase termico", "bolsa polipropileno",
      "papel freidora", "papel antiadherente", "papel aluminio", "rollo film",
      "sorbete descartable", "bombilla descartable",
      "vaso plastico", "vasos plasticos", "plato plastico", "platos plasticos",
    ],
  },
  {
    slug: "cotillon",
    words: [
      "globo", "globos", "guirnalda", "guirnaldas", "vincha", "vinchas",
      "cotillon", "pinata", "disfraz", "disfraces", "antifaz", "antifaces",
      "confeti", "serpentina", "matraca", "banderin", "banderines",
      "mantel", "manteles", "servilleta", "servilletas", "carioca",
      "velon", "velones", "vela de cumpleanos", "velitas",
      "anteojo", "anteojos", "peluca", "pelucas", "maquillaje", "corona", "coronas",
    ],
  },
  { slug: "helados", words: ["helado", "helados", "sorbete", "sorbetes", "paleta helada", "palito de agua"] },
  {
    slug: "golosinas",
    words: [
      "chocolate", "chocolates", "gomita", "gomitas", "caramelo", "caramelos",
      "alfajor", "alfajores", "chicle", "chicles", "turron", "turrones",
      "oblea", "obleas", "chupetin", "chupetines", "bombon", "bombones",
      "golosina", "golosinas", "regaliz", "marshmallow", "marshmallows", "mogul",
    ],
  },
  { slug: "galletitas", words: ["galletita", "galletitas", "galleta", "galletas", "vainillas", "oreo"] },
  {
    slug: "snacks",
    words: ["papas fritas", "nachos", "mani", "manies", "pochoclo", "pochoclos", "snack", "snacks", "chizito", "chizitos", "palitos salados", "pretzel"],
  },
  { slug: "importados", words: ["importado", "importada", "importados", "coreano", "japones", "chino"] },
  {
    slug: "regalos",
    words: ["taza", "tazas", "peluche", "peluches", "bijou", "llavero", "llaveros", "regalo", "regalos", "souvenir", "souvenirs", "agenda", "agendas", "cuaderno", "cuadernos", "lapicera", "lapiceras", "portarretrato"],
  },
];

/** Best guess for a product with no section assigned yet. Only ever used for
 *  rows the catalog has never seen: an assignment already saved in the
 *  database always wins, otherwise the next price list would undo every
 *  correction made by hand from the panel. */
export function guessCategory(name: string): string {
  const haystack = normalize(name);
  const rule = CATEGORY_RULES.find((candidate) => candidate.words.some((word) => matches(haystack, word)));
  return rule?.slug ?? FALLBACK_CATEGORY;
}

/** Products the panel offers to re-sort. Anything already filed by hand into a
 *  real section is left alone — only the general drawer gets swept. */
export function isUnsorted(category: string) {
  return normalizeCategory(category) === FALLBACK_CATEGORY;
}

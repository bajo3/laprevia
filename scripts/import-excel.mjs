// Convierte el Excel exportado de Codelector en src/data/products.ts
//
// Uso:
//   npm run import:excel -- ruta/al/archivo.xlsx
//   npm run import:excel -- ruta/al/archivo.xlsx --dry-run   (solo muestra el resultado, no escribe nada)
//
// Columnas esperadas (las trae Codelector tal cual): ID, NOMBRE, CÓDIGO, COSTO, PRECIO, STOCK, VER
// - COSTO nunca se publica en el catálogo (es tu costo interno).
// - La categoría de cada producto no viene en el Excel: se guarda una sola vez en
//   src/data/category-map.json (por ID de producto) y se reutiliza en cada reimportación.
//   Los productos nuevos se auto-categorizan por palabras clave y quedan marcados
//   para que los revises; los que ya categorizaste antes no se vuelven a tocar.
// - Las fotos se gestionan desde el dashboard /admin y se guardan por ID.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import XLSX from "xlsx";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATEGORY_MAP_PATH = path.join(ROOT, "src", "data", "category-map.json");
const PRODUCTS_OUT_PATH = path.join(ROOT, "src", "data", "products.ts");
const PHOTOS_DIR = path.join(ROOT, "public", "productos");
const PRODUCTS_INDEX_PATH = path.join(ROOT, "public", "productos-index.json");
const PRODUCTS_DATA_PATH = path.join(ROOT, "public", "catalogo-data.json");
const PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

// Espejo de src/data/catalog-config.ts y src/data/categorize.ts. Este script
// corre en Node sin bundler, así que no puede importar los .ts del frontend:
// al agregar o renombrar una sección hay que tocar los tres archivos.
export const categories = [
  { slug: "cotillon", label: "Cotillón", emoji: "🎉", color: "var(--color-pink)" },
  { slug: "reposteria", label: "Repostería", emoji: "🧁", color: "var(--color-teal-dark)" },
  { slug: "descartables", label: "Descartables", emoji: "🥤", color: "var(--color-blue)" },
  { slug: "golosinas", label: "Golosinas", emoji: "🍬", color: "var(--color-violet)" },
  { slug: "snacks", label: "Snacks", emoji: "🍟", color: "var(--color-orange)" },
  { slug: "galletitas", label: "Galletitas", emoji: "🍪", color: "var(--color-orange)" },
  { slug: "helados", label: "Helados", emoji: "🍦", color: "var(--color-teal)" },
  { slug: "sahumerios", label: "Sahumerios", emoji: "🕯️", color: "var(--color-violet-dark)" },
  { slug: "importados", label: "Importados", emoji: "🌐", color: "var(--color-yellow)" },
  { slug: "regalos", label: "Regalos", emoji: "🎁", color: "var(--color-pink-dark)" },
  { slug: "varios", label: "Varios", emoji: "🛒", color: "var(--color-ink)" },
];
const CATEGORY_SLUGS = categories.map((c) => c.slug);
const FALLBACK_CATEGORY = "varios";
// Secciones retiradas y su reemplazo, para que un category-map.json viejo siga sirviendo.
const LEGACY_SLUGS = { almacen: FALLBACK_CATEGORY };

// Palabras clave para ubicar productos nuevos. Gana la primera regla que
// coincide, y la comparación es por palabra entera: "molde" no matchea
// "moldear" ni "copal" matchea "copa larga".
const KEYWORD_RULES = [
  { slug: "sahumerios", words: ["sahumerio", "sahumerios", "sahumito", "sahumitos", "sahumador", "saphirus", "aromanza", "sagrada madre", "darshan", "asoka", "satya", "goloka", "copal", "palo santo", "incienso", "inciensos", "difusor", "difusores", "diffuser", "home spray", "aromatizante", "perfumina", "perfuminas", "citronela", "citronella"] },
  { slug: "reposteria", words: ["reposteria", "repostero", "repostera", "reposteros", "confiteria", "pirotin", "pirotines", "cortante", "cortantes", "cortador de masa", "molde", "moldes", "acetato", "tortera", "torteras", "aro para torta", "manga", "mangas", "cupla", "cuplas", "pico repostero", "picos reposteros", "espatula", "espatulas", "rodillo", "batidor", "tamiz", "termometro", "colorante", "colorantes", "fleibor", "pastelar", "ballina", "lodiser", "glase", "fondant", "chantilly", "cobertura", "banio de reposteria", "sprinkles", "granas", "grana", "confites comestibles", "comestible", "comestibles", "perlas comestibles", "dragea", "drageas", "premezcla", "polvo de hornear", "impalpable", "papel manteca", "savarin", "pionono", "merengue", "cake topper", "cake toppers", "cupcake", "cupcakes", "cup cake", "disco carton", "discos carton", "blonda", "blondas", "placa huevo", "placas huevo", "huevo de pascua", "huevos de pascua", "parpen", "shagcake", "baking", "flor de azucar", "flor azucar", "flores de azucar", "azucar impalpable"] },
  { slug: "descartables", words: ["descartable", "descartables", "roticera", "tarrina", "tarrinas", "pote telgopor", "bandeja telgopor", "vaso telgopor", "plato telgopor", "bandeja termica", "bandeja termico", "envase termico", "bolsa polipropileno", "papel freidora", "papel antiadherente", "papel aluminio", "rollo film", "sorbete descartable", "bombilla descartable", "vaso plastico", "vasos plasticos", "plato plastico", "platos plasticos"] },
  { slug: "cotillon", words: ["globo", "globos", "guirnalda", "guirnaldas", "vincha", "vinchas", "cotillon", "pinata", "disfraz", "disfraces", "antifaz", "antifaces", "confeti", "serpentina", "matraca", "banderin", "banderines", "mantel", "manteles", "servilleta", "servilletas", "carioca", "velon", "velones", "vela de cumpleanos", "velitas", "anteojo", "anteojos", "peluca", "pelucas", "maquillaje", "corona", "coronas"] },
  { slug: "helados", words: ["helado", "helados", "sorbete", "sorbetes", "paleta helada", "palito de agua"] },
  { slug: "golosinas", words: ["chocolate", "chocolates", "gomita", "gomitas", "caramelo", "caramelos", "alfajor", "alfajores", "chicle", "chicles", "turron", "turrones", "oblea", "obleas", "chupetin", "chupetines", "bombon", "bombones", "golosina", "golosinas", "regaliz", "marshmallow", "marshmallows", "mogul"] },
  { slug: "galletitas", words: ["galletita", "galletitas", "galleta", "galletas", "vainillas", "oreo"] },
  { slug: "snacks", words: ["papas fritas", "nachos", "mani", "manies", "pochoclo", "pochoclos", "snack", "snacks", "chizito", "chizitos", "palitos salados", "pretzel"] },
  { slug: "importados", words: ["importado", "importada", "importados", "coreano", "japones", "chino"] },
  { slug: "regalos", words: ["taza", "tazas", "peluche", "peluches", "bijou", "llavero", "llaveros", "regalo", "regalos", "souvenir", "souvenirs", "agenda", "agendas", "cuaderno", "cuadernos", "lapicera", "lapiceras", "portarretrato"] },
];

const EMOJI_BY_CATEGORY = Object.fromEntries(categories.map((c) => [c.slug, c.emoji]));

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const filePath = args.find((a) => !a.startsWith("--"));

if (!filePath) {
  console.error("Falta la ruta del archivo Excel.\nUso: npm run import:excel -- ruta/al/archivo.xlsx");
  process.exit(1);
}
if (!existsSync(filePath)) {
  console.error(`No se encontró el archivo: ${filePath}`);
  process.exit(1);
}

const normalize = (s) =>
  String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const parseNumber = (value) => {
  if (typeof value === "number") return value;
  const raw = String(value ?? "").trim();
  if (!raw) return Number.NaN;

  const cleaned = raw.replace(/[^\d,.-]/g, "");
  const commaIndex = cleaned.lastIndexOf(",");
  const dotIndex = cleaned.lastIndexOf(".");

  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalSeparator = commaIndex > dotIndex ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    return Number(cleaned.replaceAll(thousandsSeparator, "").replace(decimalSeparator, "."));
  }

  if (commaIndex >= 0) {
    const decimalDigits = cleaned.length - commaIndex - 1;
    return Number(decimalDigits <= 2 ? cleaned.replace(",", ".") : cleaned.replaceAll(",", ""));
  }

  if (dotIndex >= 0) {
    const decimalDigits = cleaned.length - dotIndex - 1;
    return Number(decimalDigits <= 2 ? cleaned : cleaned.replaceAll(".", ""));
  }

  return Number(cleaned);
};

const findKey = (row, candidates) => {
  const keys = Object.keys(row);
  return keys.find((k) => candidates.includes(normalize(k))) ?? null;
};

const escapeWord = (word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const matchesWord = (haystack, word) =>
  new RegExp(`(^|[^a-z0-9])${escapeWord(word)}([^a-z0-9]|$)`).test(haystack);

const guessCategory = (name) => {
  const n = normalize(name);
  for (const rule of KEYWORD_RULES) {
    if (rule.words.some((w) => matchesWord(n, w))) return rule.slug;
  }
  return FALLBACK_CATEGORY;
};

const findPhoto = (id) => {
  if (!existsSync(PHOTOS_DIR)) return null;
  for (const ext of PHOTO_EXTENSIONS) {
    if (existsSync(path.join(PHOTOS_DIR, `${id}${ext}`))) return `/productos/${id}${ext}`;
  }
  return null;
};

let categoryMap = {};
if (existsSync(CATEGORY_MAP_PATH)) {
  categoryMap = JSON.parse(readFileSync(CATEGORY_MAP_PATH, "utf-8"));
}

const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

if (rows.length === 0) {
  console.error("La planilla no tiene filas de datos.");
  process.exit(1);
}

const idKey = findKey(rows[0], ["id"]);
const nameKey = findKey(rows[0], ["nombre", "producto"]);
const priceKey = findKey(rows[0], ["precio"]);
const stockKey = findKey(rows[0], ["stock"]);
const codeKey = findKey(rows[0], ["codigo", "código"]);

if (!idKey || !nameKey || !priceKey) {
  console.error(`No se reconocen las columnas de la planilla. Se esperaba ID, NOMBRE y PRECIO. Columnas encontradas: ${Object.keys(rows[0]).join(", ")}`);
  process.exit(1);
}

const products = [];
const skipped = [];
const newlyGuessed = [];
const missingPhotos = [];

for (const row of rows) {
  const id = String(row[idKey]).trim();
  const name = String(row[nameKey]).trim();
  const price = parseNumber(row[priceKey]);
  const stock = stockKey ? parseNumber(row[stockKey]) : undefined;
  const rawCode = codeKey ? String(row[codeKey]).trim() : "";
  const code = rawCode && rawCode.toLowerCase() !== "nan" ? rawCode : "";

  if (!id || !name || !Number.isFinite(price)) {
    skipped.push({ id, name, price });
    continue;
  }

  // Un id mapeado al cajón general no aporta información: la mayoría del mapa
  // viene de antes de que existieran las secciones nuevas, así que se vuelve a
  // adivinar. Una sección real guardada a mano sí se respeta.
  let category = LEGACY_SLUGS[categoryMap[id]] ?? categoryMap[id];
  if (!category || category === FALLBACK_CATEGORY || !CATEGORY_SLUGS.includes(category)) {
    category = guessCategory(name);
    newlyGuessed.push({ id, name, category });
  }
  categoryMap[id] = category;

  const image = findPhoto(id);
  if (!image) missingPhotos.push({ id, name });

  products.push({
    id,
    name,
    ...(code ? { code } : {}),
    category,
    price: Math.round(price),
    unit: "un",
    emoji: EMOJI_BY_CATEGORY[category] ?? EMOJI_BY_CATEGORY[FALLBACK_CATEGORY],
    ...(image ? { image } : {}),
    ...(Number.isFinite(stock) ? { stock } : {}),
  });
}

// Orden fijo (por categoría y nombre) para que el catálogo no cambie de orden
// según cómo vengan las filas en el Excel de turno.
const categoryOrder = Object.fromEntries(CATEGORY_SLUGS.map((slug, i) => [slug, i]));
products.sort((a, b) => {
  const catDiff = (categoryOrder[a.category] ?? 999) - (categoryOrder[b.category] ?? 999);
  return catDiff !== 0 ? catDiff : a.name.localeCompare(b.name, "es");
});

const out = `export type Category = {
  slug: string;
  label: string;
  emoji: string;
  color: string;
};

export type Product = {
  id: string;
  name: string;
  code?: string;
  category: string;
  price: number;
  unit: string;
  emoji: string;
  badge?: "Importado" | "Promo" | "Nuevo";
  image?: string;
  stock?: number;
};

export const categories: Category[] = ${JSON.stringify(categories, null, 2)};

// Generado automáticamente por scripts/import-excel.mjs a partir del Excel de Codelector — no editar a mano.
export const products: Product[] = ${JSON.stringify(products, null, 2)};
`;

if (!dryRun) {
  writeFileSync(PRODUCTS_OUT_PATH, out);
  writeFileSync(CATEGORY_MAP_PATH, JSON.stringify(categoryMap, null, 2));
  writeFileSync(
    PRODUCTS_INDEX_PATH,
    JSON.stringify(products.map((p) => ({ id: p.id, name: p.name, category: p.category })), null, 2)
  );
  writeFileSync(PRODUCTS_DATA_PATH, JSON.stringify(products, null, 2));
}

console.log(`\n${dryRun ? "🔎 (dry-run, no se escribió nada)" : "✅"} ${products.length} productos procesados de "${path.basename(filePath)}"`);

if (skipped.length) {
  console.warn(`\n⚠️  ${skipped.length} fila(s) omitida(s) por datos faltantes:`);
  skipped.forEach((s) => console.warn(`   ID=${s.id || "?"} nombre="${s.name}" precio="${s.price}"`));
}

if (newlyGuessed.length) {
  console.log(`\n🏷️  ${newlyGuessed.length} producto(s) nuevo(s) categorizado(s) automáticamente (revisar si corresponde, corregir en src/data/category-map.json):`);
  newlyGuessed.slice(0, 20).forEach((g) => console.log(`   ID=${g.id} "${g.name}" → ${g.category}`));
  if (newlyGuessed.length > 20) console.log(`   ...y ${newlyGuessed.length - 20} más.`);
}

if (missingPhotos.length) {
  console.log(`\n📷 ${missingPhotos.length} producto(s) sin foto todavía (mostrarán un emoji). Usá el dashboard /admin para subirlas:`);
  missingPhotos.slice(0, 20).forEach((m) => console.log(`   public/productos/${m.id}.jpg   ← "${m.name}"`));
  if (missingPhotos.length > 20) console.log(`   ...y ${missingPhotos.length - 20} más.`);
}

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
// - Las fotos se buscan en public/productos/<ID>.(jpg|jpeg|png|webp). Ver admin-fotos.html
//   para subirlas arrastrando y soltando.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import XLSX from "xlsx";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATEGORY_MAP_PATH = path.join(ROOT, "src", "data", "category-map.json");
const PRODUCTS_OUT_PATH = path.join(ROOT, "src", "data", "products.ts");
const PHOTOS_DIR = path.join(ROOT, "public", "productos");
const PRODUCTS_INDEX_PATH = path.join(ROOT, "public", "productos-index.json");
const PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export const categories = [
  { slug: "cotillon", label: "Cotillón", emoji: "🎉", color: "var(--color-pink)" },
  { slug: "snacks", label: "Snacks", emoji: "🍟", color: "var(--color-orange)" },
  { slug: "golosinas", label: "Golosinas", emoji: "🍬", color: "var(--color-violet)" },
  { slug: "galletitas", label: "Galletitas", emoji: "🍪", color: "var(--color-orange)" },
  { slug: "helados", label: "Helados", emoji: "🍦", color: "var(--color-teal)" },
  { slug: "importados", label: "Importados", emoji: "🌐", color: "var(--color-yellow)" },
  { slug: "almacen", label: "Almacén", emoji: "🛒", color: "var(--color-teal-dark)" },
  { slug: "regalos", label: "Regalos", emoji: "🎁", color: "var(--color-pink-dark)" },
];
const CATEGORY_SLUGS = categories.map((c) => c.slug);

// Palabras clave para auto-categorizar productos nuevos (se puede corregir a mano después en category-map.json)
const KEYWORD_RULES = [
  { slug: "cotillon", words: ["globo", "guirnalda", "sombrero", "vela", "piñata", "pinata", "cotillon", "serpentina", "crepe", "mascara", "gorro", "vincha", "antifaz", "bomba de agua", "banderin", "confeti", "mantel descartable", "matraca", "vaso descartable", "plato descartable", "silbato"] },
  { slug: "helados", words: ["helado", "sorbete", "polo", "palito de agua", "paleta de crema", "paleta helada"] },
  { slug: "golosinas", words: ["chocolate", "gomita", "caramelo", "alfajor", "chicle", "turron", "oblea", "chupetin", "bombon", "golosina", "mentita", "toffee"] },
  { slug: "galletitas", words: ["galletita", "galleta", "vainilla", "oreo"] },
  { slug: "snacks", words: ["papas fritas", "papas rustica", "palitos salado", "nachos", "mani", "pochoclo", "snack", "pretzel", "chizito", "bastoncito de queso", "conito de queso", "rosita de maiz"] },
  { slug: "importados", words: ["importado", "importada", "coreano", "japones", "chino"] },
  { slug: "regalos", words: ["taza", "peluche", "bijou", "llavero", "regalo", "souvenir", "agenda", "cuaderno", "lapicera", "portarretrato", "manualidad"] },
];

const EMOJI_BY_CATEGORY = {
  cotillon: "🎉", snacks: "🍟", golosinas: "🍬", galletitas: "🍪",
  helados: "🍦", importados: "🌐", almacen: "🛒", regalos: "🎁",
};

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

const findKey = (row, candidates) => {
  const keys = Object.keys(row);
  return keys.find((k) => candidates.includes(normalize(k))) ?? null;
};

const guessCategory = (name) => {
  const n = normalize(name);
  for (const rule of KEYWORD_RULES) {
    if (rule.words.some((w) => n.includes(w))) return rule.slug;
  }
  return "almacen";
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
  const price = Number(String(row[priceKey]).replace(/[^\d.,-]/g, "").replace(",", "."));
  const stock = stockKey ? Number(row[stockKey]) : undefined;

  if (!id || !name || !Number.isFinite(price)) {
    skipped.push({ id, name, price });
    continue;
  }

  let category = categoryMap[id];
  if (!category || !CATEGORY_SLUGS.includes(category)) {
    category = guessCategory(name);
    categoryMap[id] = category;
    newlyGuessed.push({ id, name, category });
  }

  const image = findPhoto(id);
  if (!image) missingPhotos.push({ id, name });

  products.push({
    id,
    name,
    category,
    price: Math.round(price),
    unit: "un",
    emoji: EMOJI_BY_CATEGORY[category] ?? "🛒",
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
}

console.log(`\n${dryRun ? "🔎 (dry-run, no se escribió nada)" : "✅"} ${products.length} productos procesados de "${path.basename(filePath)}"`);

if (skipped.length) {
  console.warn(`\n⚠️  ${skipped.length} fila(s) omitida(s) por datos faltantes:`);
  skipped.forEach((s) => console.warn(`   ID=${s.id || "?"} nombre="${s.name}" precio="${s.price}"`));
}

if (newlyGuessed.length) {
  console.log(`\n🏷️  ${newlyGuessed.length} producto(s) nuevo(s) categorizado(s) automáticamente (revisar si corresponde, corregir en src/data/category-map.json):`);
  newlyGuessed.forEach((g) => console.log(`   ID=${g.id} "${g.name}" → ${g.category}`));
}

if (missingPhotos.length) {
  console.log(`\n📷 ${missingPhotos.length} producto(s) sin foto todavía (mostrarán un emoji). Usá admin-fotos.html para subirlas, guardándolas como:`);
  missingPhotos.slice(0, 20).forEach((m) => console.log(`   public/productos/${m.id}.jpg   ← "${m.name}"`));
  if (missingPhotos.length > 20) console.log(`   ...y ${missingPhotos.length - 20} más.`);
}

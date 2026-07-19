// Genera un Excel de prueba con el formato de Codelector (ID, NOMBRE, CÓDIGO, COSTO, PRECIO, STOCK, VER),
// combinando los productos reales ya existentes + 100 productos ficticios, para probar el catálogo lleno.
// Uso: node scripts/gen-fake-excel.mjs

import XLSX from "xlsx";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_PATH = path.join(ROOT, "excel-demo", "productos-100-ficticios.xlsx");

const bank = {
  cotillon: {
    names: ["Globos metalizados x10", "Globos látex x25", "Guirnalda cumpleaños", "Guirnalda feliz año nuevo",
      "Sombreros de fiesta x6", "Vinchas de fiesta x6", "Antifaz brillante", "Velas número gigante",
      "Velas de cumpleaños x12", "Piñata mediana", "Piñata grande", "Serpentina x10", "Papel crepé x10",
      "Confeti x1kg", "Manteles descartables", "Vasos descartables x25", "Platos descartables x25",
      "Bombas de agua x50", "Silbatos de cotillón x10", "Matracas x6", "Banderines cumpleaños", "Gorros de fiesta x10"],
    unit: ["paq", "un"], price: [1500, 9500],
  },
  snacks: {
    names: ["Papas fritas clásicas", "Papas fritas con cheddar", "Palitos salados", "Nachos con queso",
      "Maní salado x500g", "Pochoclo dulce", "Pochoclo salado", "Pretzels salados", "Chizitos", "Conitos de queso",
      "Bastoncitos de queso", "Rositas de maíz", "Papas rústicas"],
    unit: ["bolsa", "paq"], price: [1600, 3200],
  },
  golosinas: {
    names: ["Chocolates surtidos", "Gomitas ácidas", "Gomitas de ositos", "Caramelos masticables",
      "Caramelos duros surtidos", "Alfajores triple x6", "Alfajores blancos x6", "Chicles de menta",
      "Chicles globo", "Turrón de maní", "Obleas rellenas", "Chupetines surtidos x10", "Bombones surtidos",
      "Mentitas", "Toffees"],
    unit: ["bolsa", "caja"], price: [1400, 4200],
  },
  galletitas: {
    names: ["Galletitas de agua", "Galletitas dulces surtidas", "Vainillas", "Galletitas rellenas de chocolate",
      "Galletitas rellenas de dulce de leche", "Galletitas integrales", "Galletitas saladas con salvado", "Obleas de chocolate"],
    unit: ["paq"], price: [1600, 3400],
  },
  helados: {
    names: ["Helado 1L chocolate", "Helado 1L vainilla", "Helado 1L dulce de leche", "Helado 1L frutilla",
      "Palitos de agua x8", "Paletas de crema x6", "Sorbete de limón 1L", "Helado balde 2L"],
    unit: ["un", "caja"], price: [3200, 6500],
  },
  importados: {
    names: ["Snack coreano picante", "Gaseosa importada sabor uva", "Galletitas japonesas surtidas",
      "Chicles importados sabores", "Chocolate suizo", "Energizante importado", "Papas importadas onda ranch",
      "Caramelos importados ácidos", "Té helado importado"],
    unit: ["un", "paq"], price: [3200, 6800],
  },
  almacen: {
    names: ["Leche entera 1L", "Leche descremada 1L", "Mermelada de durazno", "Mermelada de frutilla",
      "Aceite de girasol 900ml", "Harina 0000 1kg", "Azúcar 1kg", "Yerba mate 1kg", "Café instantáneo 170g",
      "Té en saquitos x25", "Fideos guiseros 500g", "Arroz largo fino 1kg", "Polenta 500g", "Sal fina 500g",
      "Vinagre de alcohol 500ml", "Lavandina 1L", "Detergente 750ml", "Papel higiénico x4", "Jabón en polvo 800g",
      "Puré de tomate 520g", "Atún en lata", "Sardinas en lata", "Gaseosa 2.25L", "Agua mineral 1.5L",
      "Cerveza lata 473ml", "Vino tinto 750ml"],
    unit: ["un"], price: [700, 4500],
  },
  regalos: {
    names: ["Taza sorpresa temática", "Peluche mediano", "Peluche grande", "Set de bijou",
      "Llavero temático", "Vela decorativa aromática", "Portarretrato", "Agenda 2026", "Cuaderno decorado",
      "Lapicera con luz", "Set de manualidades"],
    unit: ["un"], price: [1800, 8500],
  },
};

const existingRows = [];
const seedPath = path.join(ROOT, "excel-demo", "..", "src", "data", "category-map.json");

// Base real: reusa los 2 productos ya cargados (LECHE, MERMELADA) tal como los tenemos.
existingRows.push({ ID: 3475227, NOMBRE: "LECHE", "CÓDIGO": 1, COSTO: 800, PRECIO: 1300, STOCK: 10, VER: "Ver" });
existingRows.push({ ID: 3475831, NOMBRE: "MERMELADA", "CÓDIGO": 2, COSTO: 500, PRECIO: 900, STOCK: 25, VER: "Ver" });

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];

const usedNames = new Set(existingRows.map((r) => r.NOMBRE));
const rows = [...existingRows];
let nextId = 3480000;
let code = 3;

while (rows.length < 102) {
  const catKey = pick(Object.keys(bank));
  const cat = bank[catKey];
  const name = pick(cat.names);
  if (usedNames.has(name)) continue;
  usedNames.add(name);

  const price = rand(cat.price[0], cat.price[1]);
  const cost = Math.round(price * (rand(55, 75) / 100));
  const stock = rand(0, 60);

  rows.push({
    ID: nextId++,
    NOMBRE: name,
    "CÓDIGO": code++,
    COSTO: cost,
    PRECIO: price,
    STOCK: stock,
    VER: "Ver",
  });
}

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(rows);
XLSX.utils.book_append_sheet(wb, ws, "CODELECTOR");
XLSX.writeFile(wb, OUT_PATH);

console.log(`✅ Generado ${OUT_PATH} con ${rows.length} productos (2 reales + ${rows.length - 2} ficticios).`);

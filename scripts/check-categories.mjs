/**
 * Fails the build if the catalog's sections disagree between the browser and
 * the server.
 *
 * `src/data/catalog-config.ts` and `api/_lib/categories.ts` both list the
 * sections, and they have to. The two halves compile under different tsconfigs
 * — api/ resolves modules as Node ESM and cannot import from src/ — so there
 * is no way to share one constant without a build step that would cost more
 * than it saves.
 *
 * What the duplication actually costs is the failure mode: add a section to
 * one file and forget the other and nothing complains, the browser shows a
 * button that the server rejects. That is what this catches, in the second it
 * takes to read two files.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Pulls every `slug: "..."` out of the frontend's category list. */
function frontendSlugs() {
  const source = readFileSync(path.join(ROOT, "src/data/catalog-config.ts"), "utf8");
  return [...source.matchAll(/slug:\s*"([a-z0-9-]+)"/g)].map((match) => match[1]);
}

/** Pulls the entries out of the server's CATEGORY_SLUGS array. */
function serverSlugs() {
  const source = readFileSync(path.join(ROOT, "api/_lib/categories.ts"), "utf8");
  const block = source.match(/CATEGORY_SLUGS\s*=\s*\[([^\]]*)\]/);
  if (!block) throw new Error("No se encontró CATEGORY_SLUGS en api/_lib/categories.ts");
  return [...block[1].matchAll(/"([a-z0-9-]+)"/g)].map((match) => match[1]);
}

const frontend = frontendSlugs();
const server = serverSlugs();

if (!frontend.length) throw new Error("No se encontró ninguna sección en src/data/catalog-config.ts");

const onlyFrontend = frontend.filter((slug) => !server.includes(slug));
const onlyServer = server.filter((slug) => !frontend.includes(slug));

if (onlyFrontend.length || onlyServer.length) {
  console.error("\n✖ Las secciones del catálogo no coinciden entre el frontend y la API.\n");
  if (onlyFrontend.length) {
    console.error(`  Solo en src/data/catalog-config.ts: ${onlyFrontend.join(", ")}`);
    console.error("  → Agregalas a CATEGORY_SLUGS en api/_lib/categories.ts");
  }
  if (onlyServer.length) {
    console.error(`  Solo en api/_lib/categories.ts:     ${onlyServer.join(", ")}`);
    console.error("  → Agregalas a la lista de src/data/catalog-config.ts");
  }
  console.error("\n  Acordate también de las reglas por palabra clave en src/data/categorize.ts.\n");
  process.exit(1);
}

console.log(`✓ ${frontend.length} secciones coinciden entre el frontend y la API.`);

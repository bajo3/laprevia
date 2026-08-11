import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const serverDir = path.join(distDir, "server");

mkdirSync(serverDir, { recursive: true });

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const embeddedAssets = {};

function addDirectory(directory) {
  for (const entry of readdirSync(directory)) {
    const absolutePath = path.join(directory, entry);

    if (absolutePath === serverDir) continue;
    if (statSync(absolutePath).isDirectory()) {
      addDirectory(absolutePath);
      continue;
    }

    const publicPath = `/${path.relative(distDir, absolutePath).replaceAll("\\", "/")}`;
    embeddedAssets[publicPath] = {
      body: readFileSync(absolutePath).toString("base64"),
      type: contentTypes[path.extname(entry).toLowerCase()] ?? "application/octet-stream",
    };
  }
}

addDirectory(distDir);

const workerTemplate = readFileSync(path.resolve("scripts/site-worker-template.mjs"), "utf8");
writeFileSync(
  path.join(serverDir, "index.js"),
  workerTemplate.replace("__EMBEDDED_ASSETS__", JSON.stringify(embeddedAssets)),
);

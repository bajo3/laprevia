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

writeFileSync(
  path.join(serverDir, "index.js"),
  `const assets = ${JSON.stringify(embeddedAssets)};

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const asset =
      assets[requestedPath] ??
      (request.headers.get("accept")?.includes("text/html") ? assets["/index.html"] : undefined);

    if (!asset) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(decodeBase64(asset.body), {
      headers: {
        "Content-Type": asset.type,
        "Cache-Control": requestedPath.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
};
`,
);

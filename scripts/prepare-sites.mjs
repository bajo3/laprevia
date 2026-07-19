import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const serverDir = path.resolve("dist", "server");

mkdirSync(serverDir, { recursive: true });
writeFileSync(
  path.join(serverDir, "index.js"),
  `export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
`,
);

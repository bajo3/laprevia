import { json } from "../_lib/json.js";

export const config = { runtime: "edge" };

/**
 * Exchanges a username/password for the existing ADMIN_TOKEN, so the
 * dashboard can show a normal login screen instead of asking whoever opens
 * /admin to paste a long secret. Every write endpoint still checks the
 * Bearer token exactly as before (see _lib/auth.ts) — this only changes how
 * the browser obtains that token.
 *
 * Credentials default to admin / laprevia when ADMIN_USERNAME / ADMIN_PASSWORD
 * are not set, so this works out of the box; override them in Vercel env vars
 * to use something less guessable without touching code.
 */
export default async function handler(request: Request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  const configuredToken = process.env.ADMIN_TOKEN;
  if (!configuredToken) return json({ error: "Admin token not configured" }, { status: 503 });

  const validUsername = process.env.ADMIN_USERNAME || "admin";
  const validPassword = process.env.ADMIN_PASSWORD || "laprevia";

  let body: { username?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { username?: unknown; password?: unknown };
  } catch {
    return json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const username = String(body.username ?? "");
  const password = String(body.password ?? "");

  if (username !== validUsername || password !== validPassword) {
    return json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
  }

  return json({ token: configuredToken });
}

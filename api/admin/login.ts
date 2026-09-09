import { json } from "../_lib/json.js";

export const config = { runtime: "edge" };

/**
 * Exchanges a username/password for the existing ADMIN_TOKEN, so the dashboard
 * can show a normal login screen instead of asking whoever opens /admin to
 * paste a long secret. Every write endpoint still checks the Bearer token
 * exactly as before (see _lib/auth.ts) — this only changes how the browser
 * obtains that token.
 *
 * There is deliberately no default credential any more. It used to fall back
 * to admin / laprevia, which is the site's own name and therefore the first
 * thing anyone would try, and that password is the write key to all 15.000
 * products. With ADMIN_USERNAME or ADMIN_PASSWORD missing the endpoint now
 * refuses to authenticate anybody rather than accepting a guessable pair.
 */

/** Rejects after this many failures from one address inside the window.
 *  Edge instances do not share memory, so this is not a hard guarantee — it is
 *  enough to turn a fast online guessing run into a slow one, and it costs
 *  nothing. Anything stronger needs shared storage. */
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

const attempts = new Map<string, { count: number; firstAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || now - record.firstAt > WINDOW_MS) return false;
  return record.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string) {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || now - record.firstAt > WINDOW_MS) attempts.set(key, { count: 1, firstAt: now });
  else record.count += 1;

  // The map lives as long as the instance; drop what has aged out so a long
  // running instance cannot grow it without bound.
  if (attempts.size > 5000) {
    for (const [entry, value] of attempts) {
      if (now - value.firstAt > WINDOW_MS) attempts.delete(entry);
    }
  }
}

/** Compares without leaking, through timing, how much of the value matched. */
function safeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

export default async function handler(request: Request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  const configuredToken = process.env.ADMIN_TOKEN;
  const validUsername = process.env.ADMIN_USERNAME;
  const validPassword = process.env.ADMIN_PASSWORD;

  if (!configuredToken || !validUsername || !validPassword) {
    return json(
      {
        error:
          "El panel no está configurado. Faltan ADMIN_TOKEN, ADMIN_USERNAME o ADMIN_PASSWORD en el servidor.",
      },
      { status: 503 },
    );
  }

  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocido";
  if (rateLimited(client)) {
    return json(
      { error: "Demasiados intentos fallidos. Esperá unos minutos y probá de nuevo." },
      { status: 429, headers: { "Retry-After": "600" } },
    );
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { username?: unknown; password?: unknown };
  } catch {
    return json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const username = String(body.username ?? "");
  const password = String(body.password ?? "");

  // Both comparisons always run, so a wrong username and a wrong password take
  // the same time and neither can be probed independently.
  const usernameMatches = safeEquals(username, validUsername);
  const passwordMatches = safeEquals(password, validPassword);

  if (!usernameMatches || !passwordMatches) {
    recordFailure(client);
    return json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
  }

  attempts.delete(client);
  return json({ token: configuredToken });
}

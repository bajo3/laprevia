import { getSupabaseAdmin } from "./_lib/supabase.js";
import { json } from "./_lib/json.js";

export const config = { runtime: "edge" };

export default async function handler() {
  const supabase = getSupabaseAdmin();
  return json({ ok: true, database: Boolean(supabase) });
}

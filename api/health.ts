import { getSupabaseAdmin } from "./_lib/supabase";
import { json } from "./_lib/json";

export const config = { runtime: "edge" };

export default async function handler() {
  const supabase = getSupabaseAdmin();
  return json({ ok: true, database: Boolean(supabase) });
}

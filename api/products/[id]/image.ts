import { getSupabaseAdmin } from "../../_lib/supabase.js";
import { isAdminAuthorized } from "../../_lib/auth.js";
import { json } from "../../_lib/json.js";
import { lastSegment } from "../../_lib/product.js";

export const config = { runtime: "edge" };

const BUCKET = "product-images";

function idFromUrl(request: Request) {
  // /api/products/:id/image -> second to last segment
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  return decodeURIComponent(segments[segments.length - 2] ?? "");
}

function newImageKey(id: string) {
  return `products/${encodeURIComponent(id)}/${crypto.randomUUID()}`;
}

export default async function handler(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return json({ error: "Database not configured" }, { status: 503 });
    const id = idFromUrl(request);

    const { data: product } = await supabase
      .from("products")
      .select("image_key")
      .eq("id", id)
      .maybeSingle();
    const currentKey = (product?.image_key as string | null) ?? null;

    if (request.method === "GET") {
      if (!currentKey) return new Response("Not found", { status: 404 });
      const { data, error } = await supabase.storage.from(BUCKET).download(currentKey);
      if (error || !data) return new Response("Not found", { status: 404 });
      return new Response(data, {
        headers: {
          "Content-Type": data.type || "application/octet-stream",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    if (request.method === "POST") {
      if (!isAdminAuthorized(request)) return json({ error: "Unauthorized" }, { status: 401 });
      if (!product) return json({ error: "Product not found" }, { status: 404 });

      const form = await request.formData();
      const file = form.get("file");
      if (!file || typeof file === "string" || !file.type.startsWith("image/")) {
        return json({ error: "An image file is required" }, { status: 400 });
      }
      if (file.size > 8 * 1024 * 1024) return json({ error: "Image must be smaller than 8 MB" }, { status: 413 });

      const nextKey = newImageKey(id);
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(nextKey, file, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });
      if (uploadError) return json({ error: uploadError.message }, { status: 500 });

      await supabase
        .from("products")
        .update({ image_key: nextKey, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (currentKey && currentKey !== nextKey) await supabase.storage.from(BUCKET).remove([currentKey]);

      const version = lastSegment(nextKey);
      return json({
        id,
        image: `/api/products/${encodeURIComponent(id)}/image?v=${encodeURIComponent(version ?? "")}`,
      });
    }

    if (request.method === "DELETE") {
      if (!isAdminAuthorized(request)) return json({ error: "Unauthorized" }, { status: 401 });
      if (currentKey) await supabase.storage.from(BUCKET).remove([currentKey]);
      await supabase
        .from("products")
        .update({ image_key: null, updated_at: new Date().toISOString() })
        .eq("id", id);
      return json({ id, image: null });
    }

    return json({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 });
  }
}

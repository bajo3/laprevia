/** Longest edge of the stored image. Cards show it around 150–320px, so this
 *  still leaves room for retina screens without storing camera-sized files. */
const MAX_EDGE = 1000;
const QUALITY = 0.82;

/**
 * Shrinks a photo in the browser before uploading it.
 *
 * Phone cameras produce 2–5 MB images, and the catalog would then serve those
 * multi-megabyte files to every shopper for a thumbnail. Resizing here keeps
 * uploads fast and the public catalog light, with no image tooling on the server.
 *
 * Falls back to the original file if anything goes wrong — a slightly heavy
 * photo is better than a failed upload.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch {
    return file;
  }
}

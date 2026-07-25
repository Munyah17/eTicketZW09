"use client";

// Organizers upload whatever their phone/camera produces — often 3000px+
// and well past any single fixed size limit. Rather than maintaining one
// hard cutoff that's always wrong for someone, this shrinks the image to a
// sane display dimension and re-encodes it at high-but-lossy quality
// (stepping quality down if it's still large), so an upload almost never
// gets flatly rejected — it just gets a smaller file at effectively the
// same visual quality.
export async function compressImageFile(
  file: File,
  opts: { maxDimension?: number; maxBytes?: number } = {}
): Promise<File> {
  const maxDimension = opts.maxDimension ?? 2000;
  const maxBytes = opts.maxBytes ?? 6 * 1024 * 1024; // 6MB

  // Animated GIFs would be flattened to a single frame by canvas — leave
  // them untouched rather than silently breaking the animation.
  if (file.type === "image/gif") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Undecodable in-browser (e.g. an unsupported format) — let server-side
    // validation reject it with a clear message instead of failing silently here.
    return file;
  }

  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    let blob: Blob | null = null;
    let quality = 0.9;
    for (let attempt = 0; attempt < 5; attempt++) {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob || blob.size <= maxBytes || quality <= 0.5) break;
      quality -= 0.1;
    }

    if (!blob || blob.size >= file.size) return file; // compression didn't actually help — keep the original

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

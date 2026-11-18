/**
 * Shrinks an image in the browser before upload. Vercel limits a serverless request body to about 4.5 MB
 * (below the upload route's 8 MB cap), so a phone photo must be made smaller here: at most 1600 px wide
 * (never upscaled), re-encoded as WebP at 0.85. The server converts and resizes again either way.
 */
export const MAX_WIDTH = 1600;
export const QUALITY = 0.85;
/** Fallback when the canvas cannot be used: send the original only if it is comfortably small. */
export const FALLBACK_MAX_BYTES = 3 * 1024 * 1024;
/** Anything larger is refused before sending, with a readable message. */
export const SEND_MAX_BYTES = 4 * 1024 * 1024;

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type Prepared = { ok: true; blob: Blob; name: string; note?: string } | { ok: false; message: string };

function baseName(name: string) {
  return name.replace(/\.[^.]*$/, "") || "image";
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close(): void }> {
  if (typeof createImageBitmap === "function") {
    const bmp = await createImageBitmap(file);
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

async function toWebp(file: File): Promise<Blob | null> {
  const img = await decode(file);
  try {
    if (!img.width || !img.height) return null;
    const scale = Math.min(1, MAX_WIDTH / img.width);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img.source, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", QUALITY));
    // A browser without a WebP encoder silently returns PNG; that is still an accepted type.
    return blob && ACCEPTED_TYPES.includes(blob.type) ? blob : null;
  } finally {
    img.close();
  }
}

export async function prepareImage(file: File): Promise<Prepared> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { ok: false, message: "Choose a JPEG, PNG or WebP image." };
  }
  let blob: Blob | null = null;
  try {
    blob = await toWebp(file);
  } catch {
    blob = null;
  }
  if (blob) {
    if (blob.size > SEND_MAX_BYTES) {
      return { ok: false, message: "Even after shrinking, this image is over 4 MB. Try a smaller or simpler image." };
    }
    const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
    return { ok: true, blob, name: `${baseName(file.name)}.${ext}` };
  }
  if (file.size < FALLBACK_MAX_BYTES) {
    return { ok: true, blob: file, name: file.name, note: "Could not shrink the image in the browser; sending the original." };
  }
  return {
    ok: false,
    message: "This browser could not shrink the image, and it is too large (3 MB or more) to send as it is. Resize it first, then try again.",
  };
}

import "server-only";
import sharp from "sharp";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_WIDTH = 1600;
// Decompression-bomb guard: ~50 megapixels (a 12 MP phone photo is far below).
const MAX_INPUT_PIXELS = 50_000_000;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageError";
  }
}

export async function processImage(
  input: Buffer,
  mime: string,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  if (!ALLOWED_MIME.has(mime)) {
    throw new ImageError("Only JPEG, PNG or WebP images are allowed.");
  }
  if (input.length > MAX_IMAGE_BYTES) {
    throw new ImageError("Image is too large (max 8 MB).");
  }
  try {
    const opts = { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" as const };
    const meta = await sharp(input, opts).metadata();
    if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
      throw new ImageError("Only JPEG, PNG or WebP images are allowed.");
    }
    const { data, info } = await sharp(input, opts)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height };
  } catch (err) {
    if (err instanceof ImageError) throw err;
    throw new ImageError("That file could not be read as an image.");
  }
}

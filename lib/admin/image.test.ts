import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { processImage, ImageError } from "@/lib/admin/image";

const png = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#336699" } }).png().toBuffer();
const jpeg = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#996633" } }).jpeg().toBuffer();

describe("processImage", () => {
  it("downsizes a 3000px PNG to a 1600px WebP", async () => {
    const out = await processImage(await png(3000, 1500), "image/png");
    expect(out.width).toBe(1600);
    expect(out.height).toBe(800);
    expect((await sharp(out.buffer).metadata()).format).toBe("webp");
  });

  it("does not upscale a 400px JPEG", async () => {
    const out = await processImage(await jpeg(400, 300), "image/jpeg");
    expect(out.width).toBe(400);
    expect(out.height).toBe(300);
  });

  it("rejects a GIF mime", async () => {
    await expect(processImage(await png(10, 10), "image/gif")).rejects.toBeInstanceOf(ImageError);
  });

  it("rejects random bytes labelled image/png", async () => {
    const junk = Buffer.from(Array.from({ length: 500 }, (_, i) => (i * 37) % 251));
    await expect(processImage(junk, "image/png")).rejects.toBeInstanceOf(ImageError);
  });

  it("rejects input over 8 MB", async () => {
    await expect(processImage(Buffer.alloc(9 * 1024 * 1024), "image/png")).rejects.toBeInstanceOf(ImageError);
  });

  it("rejects a decoded format outside the allowlist even with an allowed mime", async () => {
    const gif = await sharp(await png(10, 10)).gif().toBuffer();
    await expect(processImage(gif, "image/png")).rejects.toBeInstanceOf(ImageError);
  });

  it("rejects a decompression bomb", async () => {
    const big = await png(12000, 12000); // 144 MP, compresses tiny
    expect(big.length).toBeLessThan(8 * 1024 * 1024);
    await expect(processImage(big, "image/png")).rejects.toBeInstanceOf(ImageError);
  });
});

import type { NextConfig } from "next";

/**
 * Two builds from one codebase.
 *
 * `npm run build` is the deployed one: Vercel serves it and Next optimises
 * images on request.
 *
 * `npm run build:static` writes a plain folder of HTML, CSS, JS and assets to
 * `out/`, which runs on anything that can serve files — GitHub Pages, S3,
 * Netlify, shared hosting over FTP. No Node, no Next.js runtime.
 *
 * The only thing static export gives up is on-request image optimisation. That
 * does cost something now: the project covers are the 1400-1841px originals as
 * JPEG, and the optimiser is what turns them into right-sized WebP/AVIF for each
 * screen, so the static build serves them as they are (larger, but unchanged).
 *
 * Next 16 only honours the image qualities listed in `images.qualities` (the
 * default is just 75) and rounds any other `quality` prop to the nearest one.
 * The covers ask for 90, so 90 is listed here.
 */
const STATIC = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(STATIC
    ? { output: "export" as const, images: { unoptimized: true } }
    : { images: { formats: ["image/avif" as const, "image/webp" as const], qualities: [75, 90] } }),
};

export default nextConfig;

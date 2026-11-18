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
 * Static export cannot contain route handlers or the admin, so `build:static` runs
 * `tools/build-static.mjs`, which builds a throwaway copy without `app/(admin)` and `app/api`.
 * The real tree is never modified.
 *
 * The only thing static export gives up is on-request image optimisation, and
 * here that costs close to nothing: the six project covers are already 808px
 * WebP and 268 kB between them, so the optimiser was barely earning its place.
 */
const STATIC = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(STATIC
    ? {
        output: "export" as const,
        images: { unoptimized: true },
        // tools/build-static.mjs builds a copy in .static-build/ (no admin, no API); node_modules lives one level up.
        ...(process.env.STATIC_ROOT ? { turbopack: { root: process.env.STATIC_ROOT } } : {}),
      }
    : {
        images: {
          formats: ["image/avif" as const, "image/webp" as const],
          // Admin-uploaded images live in Vercel Blob (public stores).
          remotePatterns: [
            { protocol: "https" as const, hostname: "*.public.blob.vercel-storage.com" },
          ],
        },
      }),
};

export default nextConfig;

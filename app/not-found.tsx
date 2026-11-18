import type { Metadata, ResolvingMetadata, Viewport } from "next";
import { SiteChrome } from "@/components/Chrome/SiteChrome";
import { getContent } from "@/lib/content-store";
import { siteMetadata } from "@/lib/seo";
import { THEME_COLOR } from "@/lib/theme-config";

/**
 * Unmatched URLs (and unknown /work slugs) render here, inside the root layout but outside the (site)
 * group. Before the layout split they were Next's default 404 inside the site chrome with the site's
 * metadata; this keeps the chrome and metadata, with a small local 404 in place of Next's builtin one
 * (whose module is internal to Next).
 */
export async function generateMetadata(_: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  const [content, resolved] = await Promise.all([getContent(), parent]);
  return siteMetadata(content, { ogImages: resolved.openGraph?.images, twitterImages: resolved.twitter?.images });
}

export const viewport: Viewport = { themeColor: THEME_COLOR, colorScheme: "dark" };

export default function SiteNotFound() {
  return (
    <SiteChrome>
      {/* React hoists this into <head>, as Next's builtin 404 did */}
      <title>404: This page could not be found.</title>
      <main id="main" className="gutter flex min-h-[100svh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-display font-light leading-none tracking-[-0.03em]">404</h1>
        <p className="text-body text-bone/80">This page could not be found.</p>
      </main>
    </SiteChrome>
  );
}

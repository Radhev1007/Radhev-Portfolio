import type { Metadata, ResolvingMetadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SiteChrome } from "@/components/Chrome/SiteChrome";
import { getContent } from "@/lib/content-store";
import { siteMetadata } from "@/lib/seo";
import { THEME_COLOR } from "@/lib/theme-config";

/**
 * The share image file (app/opengraph-image.tsx) stays at the app root so its URL stays /opengraph-image
 * (inside a route group Next would suffix it). Its tags are attached to the root segment, and this layout's
 * `openGraph`/`twitter` objects replace the parent's whole, so the resolved images are carried over here.
 */
export async function generateMetadata(_: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  const [content, resolved] = await Promise.all([getContent(), parent]);
  return siteMetadata(content, { ogImages: resolved.openGraph?.images, twitterImages: resolved.twitter?.images });
}

export const viewport: Viewport = { themeColor: THEME_COLOR, colorScheme: "dark" };

/** The public site: its chrome and content come from the store (lib/content-store.ts). */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}

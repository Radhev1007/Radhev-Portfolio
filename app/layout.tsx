import type { Metadata } from "next";
import { Host_Grotesk } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
import { getContent } from "@/lib/content-store";
import { safeSiteUrl } from "@/lib/seo";
import "@/styles/globals.css";

const sans = Host_Grotesk({ subsets: ["latin"], variable: "--font-host-grotesk", display: "swap" });

/*
 * One typeface. Geist Mono, used for the small uppercase labels, is gone: they are Host Grotesk at 500 with
 * tabular figures (so the status bar's clock does not jitter), and `--font-mono` points at the same face.
 */

/**
 * Only the base URL lives here, so the share image file at the app root (app/opengraph-image.tsx) resolves to
 * the site's own origin. The rest of the site-wide metadata is in app/(site)/layout.tsx.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getContent();
  return { metadataBase: new URL(safeSiteUrl(site.url)) };
}

/**
 * The root layout is only the document: font and global CSS (analytics live in the public chrome, so /admin is not counted). The public site's chrome, content
 * and metadata live in app/(site)/layout.tsx; route groups add no URL segment.
 *
 * An (admin) group must provide its own layout, and must not render components that call useContent()
 * (Navigation, Footer, StatusBar, IntroLoader, the home sections…) unless it wraps them in a ContentProvider:
 * useContent() throws outside one.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Open every page on its hero so entrance choreography plays in full. (A beforeInteractive script
            must sit in the root layout.) */}
        <Script id="scroll-restoration" strategy="beforeInteractive">{`history.scrollRestoration='manual'`}</Script>
        {children}
      </body>
    </html>
  );
}

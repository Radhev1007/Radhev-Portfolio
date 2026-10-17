import type { Metadata, Viewport } from "next";
import { Geist_Mono, Host_Grotesk } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import type { ReactNode } from "react";
import { Backdrop } from "@/components/Chrome/Backdrop";
import { StatusBar } from "@/components/Chrome/StatusBar";
import { Cursor } from "@/components/Cursor/Cursor";
import { IntroLoader } from "@/components/Chrome/IntroLoader";
import { Footer } from "@/components/Footer/Footer";
import { Navigation } from "@/components/Navigation/Navigation";
import { SmoothScroll } from "@/components/Providers/SmoothScroll";
import { site } from "@/lib/content";
import { fullName, seoDescription, seoKeywords, seoTitle } from "@/lib/seo";
import { THEME_COLOR } from "@/lib/theme-config";
import "@/styles/globals.css";

const sans = Host_Grotesk({ subsets: ["latin"], variable: "--font-host-grotesk", display: "swap" });

/**
 * A real monospace. `--font-mono` was aliased to the sans, so every
 * `font-mono` on the site — the hero statement, the status bar, the cursor
 * label, buttons — has been asking for a typewriter and getting a grotesk.
 * One weight, latin only.
 */
const mono = Geist_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-geist-mono", display: "swap" });


export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: seoTitle, template: `%s — ${fullName}` },
  description: seoDescription,
  keywords: seoKeywords,
  authors: [{ name: fullName, url: site.url }],
  creator: fullName,
  applicationName: fullName,
  category: "design",
  alternates: { canonical: "/" },
  // the share image comes from app/opengraph-image.tsx
  openGraph: { type: "profile", url: "/", siteName: fullName, locale: "en_IN", title: seoTitle, description: seoDescription, firstName: site.name.first, lastName: site.name.last },
  twitter: { card: "summary_large_image", title: seoTitle, description: seoDescription },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  formatDetection: { telephone: false, email: false, address: false },
  // Google Search Console ownership (URL-prefix property https://www.radhev.in/); keep it, or the property unverifies
  verification: { google: "YifXl9A4K9ljMZd9yQOb6AVcJcJu_xLoIV0ysDQIWpM" },
};

export const viewport: Viewport = { themeColor: THEME_COLOR, colorScheme: "dark" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Open every page on its hero so entrance choreography plays in full. */}
        <Script id="scroll-restoration" strategy="beforeInteractive">{`history.scrollRestoration='manual'`}</Script>
        <a
          href="#main"
          className="fixed left-4 top-4 z-[200] -translate-y-24 bg-bone px-4 py-2 text-small text-ink focus:translate-y-0"
        >
          Skip to content
        </a>
        <Backdrop />
        <SmoothScroll>
            <IntroLoader />
            <Navigation />
            {children}
            <Footer />
            <StatusBar />
            <Cursor />
        </SmoothScroll>
        {/* Vercel Web Analytics: visits, pages, referrers, countries and devices, without cookies (vercel.com →
            project → Analytics). Sends nothing outside Vercel, e.g. on localhost or the static build. */}
        <Analytics />
      </body>
    </html>
  );
}

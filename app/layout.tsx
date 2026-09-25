import type { Metadata, Viewport } from "next";
import { Inter_Tight } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
import { Cursor } from "@/components/Cursor/Cursor";
import { Footer } from "@/components/Footer/Footer";
import { Navigation } from "@/components/Navigation/Navigation";
import { ProjectTransitionProvider } from "@/components/Providers/ProjectTransition";
import { SmoothScroll } from "@/components/Providers/SmoothScroll";
import { site } from "@/lib/content";
import { THEME_COLORS, themeInitScript } from "@/lib/theme-config";
import "@/styles/globals.css";

const sans = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });
/** Adobe Fonts kit that serves Roc Grotesk (optional; see styles/globals.css). */
const adobeKit = process.env.NEXT_PUBLIC_ADOBE_FONTS_KIT;

export const metadata: Metadata = {
  title: { default: `${site.name.first} ${site.name.last} — ${site.role}`, template: `%s — ${site.name.first} ${site.name.last}` },
  description: site.statement,
  openGraph: { title: `${site.name.first} ${site.name.last} — ${site.role}`, description: site.statement, type: "website" },
};

export const viewport: Viewport = { themeColor: THEME_COLORS.dark, colorScheme: "dark light" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={sans.variable} suppressHydrationWarning>
      {adobeKit && (
        <head>
          <link rel="preconnect" href="https://use.typekit.net" crossOrigin="" />
          <link rel="stylesheet" href={`https://use.typekit.net/${adobeKit}.css`} />
        </head>
      )}
      <body suppressHydrationWarning>
        {/* Open every page on its hero so entrance choreography plays in full. */}
        <Script id="theme-init" strategy="beforeInteractive">{themeInitScript}</Script>
        <Script id="scroll-restoration" strategy="beforeInteractive">{`history.scrollRestoration='manual'`}</Script>
        <a
          href="#main"
          className="fixed left-4 top-4 z-[200] -translate-y-24 rounded-full bg-bone px-5 py-3 text-sm text-ink focus:translate-y-0"
        >
          Skip to content
        </a>
        <SmoothScroll>
          <ProjectTransitionProvider>
            <Navigation />
            {children}
            <Footer />
            <Cursor />
          </ProjectTransitionProvider>
        </SmoothScroll>
      </body>
    </html>
  );
}

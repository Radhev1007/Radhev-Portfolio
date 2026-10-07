import type { Metadata, Viewport } from "next";
import { Host_Grotesk } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
import { Backdrop } from "@/components/Chrome/Backdrop";
import { StatusBar } from "@/components/Chrome/StatusBar";
import { Cursor } from "@/components/Cursor/Cursor";
import { Footer } from "@/components/Footer/Footer";
import { Navigation } from "@/components/Navigation/Navigation";
import { ProjectTransitionProvider } from "@/components/Providers/ProjectTransition";
import { SmoothScroll } from "@/components/Providers/SmoothScroll";
import { site } from "@/lib/content";
import { THEME_COLOR } from "@/lib/theme-config";
import "@/styles/globals.css";

const sans = Host_Grotesk({ subsets: ["latin"], variable: "--font-host-grotesk", display: "swap" });


export const metadata: Metadata = {
  title: { default: `${site.name.first} ${site.name.last} — ${site.role}`, template: `%s — ${site.name.first} ${site.name.last}` },
  description: site.statement,
  openGraph: { title: `${site.name.first} ${site.name.last} — ${site.role}`, description: site.statement, type: "website" },
};

export const viewport: Viewport = { themeColor: THEME_COLOR, colorScheme: "dark" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={sans.variable} suppressHydrationWarning>
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
          <ProjectTransitionProvider>
            <Navigation />
            {children}
            <Footer />
            <StatusBar />
            <Cursor />
          </ProjectTransitionProvider>
        </SmoothScroll>
      </body>
    </html>
  );
}

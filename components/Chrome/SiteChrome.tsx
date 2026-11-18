import { Analytics } from "@vercel/analytics/next";
import type { ReactNode } from "react";
import { Backdrop } from "@/components/Chrome/Backdrop";
import { StatusBar } from "@/components/Chrome/StatusBar";
import { Cursor } from "@/components/Cursor/Cursor";
import { IntroLoader } from "@/components/Chrome/IntroLoader";
import { Footer } from "@/components/Footer/Footer";
import { Navigation } from "@/components/Navigation/Navigation";
import { ContentProvider } from "@/components/Providers/ContentProvider";
import { SmoothScroll } from "@/components/Providers/SmoothScroll";
import { getContent } from "@/lib/content-store";

/**
 * The public site's chrome (skip link, backdrop, smooth scroll, intro, navigation, footer, status bar,
 * cursor), fed by the stored content. Used by app/(site)/layout.tsx and by app/not-found.tsx, which
 * renders outside the (site) group.
 */
export async function SiteChrome({ children }: { children: ReactNode }) {
  const content = await getContent();
  return (
    <ContentProvider content={content}>
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
          project → Analytics). Public pages only (not /admin). Sends nothing outside Vercel, e.g. on localhost
          or the static build. */}
      <Analytics />
    </ContentProvider>
  );
}

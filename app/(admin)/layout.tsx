import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./admin.css";

/**
 * The admin area: its own plain, light layout. It deliberately renders none of the portfolio chrome
 * (SiteChrome, cursor, smooth scroll, ContentProvider consumers) and is kept out of search engines.
 */
export const metadata: Metadata = {
  title: "Content admin",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = { themeColor: "#f5f5f5", colorScheme: "light" };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="admin-root min-h-[100svh] bg-neutral-100 font-sans text-neutral-900">{children}</div>;
}

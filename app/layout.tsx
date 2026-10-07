import type { Metadata, Viewport } from "next";
import { Host_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { site } from "@/lib/content";
import "@/styles/globals.css";

const sans = Host_Grotesk({ subsets: ["latin"], variable: "--font-host-grotesk", display: "swap" });

const title = `${site.name.first} ${site.name.last} — ${site.role}`;

export const metadata: Metadata = {
  title: { default: title, template: `%s — ${site.name.first} ${site.name.last}` },
  description: site.statement,
  openGraph: { title, description: site.statement, type: "website" },
};

export const viewport: Viewport = { themeColor: "#faf9f6", colorScheme: "light" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <a
          href="#main"
          className="label fixed left-4 top-4 z-50 -translate-y-24 bg-ink px-4 py-3 !text-paper focus:translate-y-0"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}

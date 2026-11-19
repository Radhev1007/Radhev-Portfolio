import { ImageResponse } from "next/og";
import { site } from "@/lib/content";
import { fullName } from "@/lib/seo";

/**
 * The card shown when the site is shared (LinkedIn, WhatsApp, X, Slack…):
 * name, role and positioning on the site's black, with the accent. Rendered
 * once at build time.
 */
export const dynamic = "force-static";
export const alt = `${fullName} — ${site.role}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#000000", BONE = "#ffffff", ACCENT = "#8c8c8c", DIM = "rgba(255,255,255,0.55)";

export default function Image() {
  const { greeting, tagline } = site.heroTitle;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: INK, color: BONE, padding: "72px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 28, letterSpacing: 6, textTransform: "uppercase" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 18, height: 18, background: ACCENT }} />
            {fullName}
          </div>
          <div style={{ color: DIM, fontSize: 24 }}>{site.url.replace(/^https?:\/\//, "")}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 96, lineHeight: 1, letterSpacing: -3 }}>{greeting}</div>
          <div style={{ display: "flex", maxWidth: 960, fontSize: 40, lineHeight: 1.2, letterSpacing: -1, color: DIM }}>{tagline}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 26, color: DIM }}>
          <div style={{ display: "flex", maxWidth: 760, lineHeight: 1.4 }}>Enterprise SaaS · Government platforms · Dashboards · Fintech · Design systems</div>
          <div style={{ display: "flex", color: BONE, letterSpacing: 3, textTransform: "uppercase", fontSize: 21, whiteSpace: "nowrap" }}>{site.role}</div>
        </div>
      </div>
    ),
    size,
  );
}

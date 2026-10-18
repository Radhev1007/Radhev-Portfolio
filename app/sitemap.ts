import type { MetadataRoute } from "next";
import { projects, site, workPath } from "@/lib/content";

/**
 * The home page and each project's page. No `lastModified`: the build time
 * was stamped on every page at every deploy, which is not when any of them
 * changed, and search engines learn to ignore a date that is always new.
 */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site.url}/`, changeFrequency: "monthly", priority: 1 },
    ...projects.map((p) => ({ url: `${site.url}${workPath(p)}`, changeFrequency: "yearly" as const, priority: 0.8 })),
  ];
}

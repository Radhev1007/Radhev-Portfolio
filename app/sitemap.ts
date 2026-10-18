import type { MetadataRoute } from "next";
import { projects, site, workPath } from "@/lib/content";

/** The home page and each project's page; their last change is the build that produced them. */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${site.url}/`, lastModified, changeFrequency: "monthly", priority: 1 },
    ...projects.map((p) => ({ url: `${site.url}${workPath(p)}`, lastModified, changeFrequency: "yearly" as const, priority: 0.8 })),
  ];
}

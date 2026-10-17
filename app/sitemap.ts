import type { MetadataRoute } from "next";
import { site } from "@/lib/content";

/** One page; its last change is the build that produced it. */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${site.url}/`, lastModified: new Date(), changeFrequency: "monthly", priority: 1 }];
}

import type { MetadataRoute } from "next";
import { getContent } from "@/lib/content-store";

/**
 * Everything is open to crawlers except the RC garage's game files: the game
 * only runs inside the page, and its megabytes of models and scripts are not
 * worth a crawler's time.
 */
export const dynamic = "force-static";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { site } = await getContent();
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/rc-crawler/" },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}

import { describe, expect, it } from "vitest";
import { defaultContent } from "@/lib/content";
import { homeJsonLd, safeSiteUrl, siteMetadata } from "@/lib/seo";

const withUrl = (url: string) => ({ ...defaultContent, site: { ...defaultContent.site, url } });

describe("safeSiteUrl", () => {
  it("keeps a good origin and drops a trailing slash", () => {
    expect(safeSiteUrl("https://www.example.com")).toBe("https://www.example.com");
    expect(safeSiteUrl("https://www.example.com/")).toBe("https://www.example.com");
  });
  it("falls back to the default for unparseable or non-http(s) values", () => {
    for (const bad of ["https://x.com:99999", "not a url", "", "javascript:alert(1)"]) {
      expect(safeSiteUrl(bad)).toBe(defaultContent.site.url);
    }
  });
  it("siteMetadata and structured data never throw on a bad stored URL", () => {
    const c = withUrl("https://x.com:99999");
    expect(() => siteMetadata(c)).not.toThrow();
    expect(() => homeJsonLd(c)).not.toThrow();
    expect(String(siteMetadata(c).metadataBase)).toBe(`${defaultContent.site.url}/`);
  });
});

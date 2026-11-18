import { describe, expect, it } from "vitest";
import { defaultContent } from "@/lib/content";
import { parseContent } from "@/lib/content-schema";

const clone = () => structuredClone(defaultContent) as any;

function issuesFor(input: unknown) {
  const r = parseContent(input);
  if (r.ok) throw new Error("expected failure");
  return r.issues;
}

describe("parseContent", () => {
  it("defaults validate", () => {
    const r = parseContent(defaultContent);
    if (!r.ok) console.log(r.issues);
    expect(r.ok).toBe(true);
  });

  it("rejects empty slug", () => {
    const c = clone();
    c.projects[2].slug = "";
    expect(issuesFor(c).map((i) => i.path)).toContain("projects.2.slug");
  });

  it("rejects duplicate slugs", () => {
    const c = clone();
    c.projects[3].slug = c.projects[0].slug;
    const issues = issuesFor(c);
    expect(issues.some((i) => i.path === "projects.3.slug" && /unique|duplicate/i.test(i.message))).toBe(true);
  });

  it('rejects slug "My Project/1"', () => {
    const c = clone();
    c.projects[1].slug = "My Project/1";
    expect(issuesFor(c).map((i) => i.path)).toContain("projects.1.slug");
  });

  it('rejects palette.from "red"', () => {
    const c = clone();
    c.projects[0].palette.from = "red";
    expect(issuesFor(c).map((i) => i.path)).toContain("projects.0.palette.from");
  });

  it("rejects non-array projects", () => {
    const c = clone();
    c.projects = "nope";
    expect(issuesFor(c).map((i) => i.path)).toContain("projects");
  });

  it("rejects image not starting with / or https://", () => {
    const c = clone();
    c.projects[0].image = "http://x/y.png";
    expect(issuesFor(c).map((i) => i.path)).toContain("projects.0.image");
  });
});

describe("parseContent extra cases", () => {
  const paths = (c: unknown) => issuesFor(c).map((i) => i.path);

  it("accepts https and root-relative images", () => {
    for (const image of ["https://abc123.public.blob.vercel-storage.com/a-x.webp", "/projects/a.webp"]) {
      const c = clone();
      c.projects[0].image = image;
      expect(parseContent(c).ok).toBe(true);
    }
  });

  it("rejects empty-string image", () => {
    const c = clone();
    c.projects[0].image = "";
    expect(paths(c)).toContain("projects.0.image");
  });

  it("rejects non-object root", () => {
    for (const bad of [null, "x", 5, []]) expect(parseContent(bad).ok).toBe(false);
  });

  it("reports nested paths", () => {
    const c = clone();
    c.projects[0].story.screens[1].title = "";
    expect(paths(c)).toContain("projects.0.story.screens.1.title");
  });

  it("rejects bad site url", () => {
    const c = clone();
    c.site.url = "not a url";
    expect(paths(c)).toContain("site.url");
  });

  it("rejects empty required field in experience", () => {
    const c = clone();
    c.experience[1].company = "";
    expect(paths(c)).toContain("experience.1.company");
  });
});

describe("tightened validation", () => {
  const paths = (c: unknown) => issuesFor(c).map((i) => i.path);
  const withSite = (url: string) => {
    const c = clone();
    c.site.url = url;
    return c;
  };

  it("experience needs at least one role", () => {
    const c = clone();
    c.experience = [];
    expect(paths(c)).toContain("experience");
  });

  it("experience dates must be 'Mon YYYY' (to may be Present)", () => {
    for (const bad of ["2023", "January 2023", "jan 2023", "Jan 23", "Present"]) {
      const c = clone();
      c.experience[0].from = bad;
      expect(paths(c)).toContain("experience.0.from");
    }
    for (const bad of ["2023", "present", ""]) {
      const c = clone();
      c.experience[0].to = bad;
      expect(paths(c)).toContain("experience.0.to");
    }
    const ok = clone();
    ok.experience[0].to = "Present";
    ok.experience[1].to = "Dec 2024";
    expect(parseContent(ok).ok).toBe(true);
  });

  it("site.url must be a bare https origin", () => {
    for (const bad of ["https://x.com:99999", "https://x.com/", "https://x.com/a", "https://x.com?q=1", "https://x.com#h", "http://x.com", "not a url"]) {
      expect(paths(withSite(bad)), bad).toContain("site.url");
    }
    expect(parseContent(withSite("https://www.example.com")).ok).toBe(true);
    expect(parseContent(withSite("https://localhost:3000".replace("https", "https"))).ok).toBe(true);
  });

  it("other absolute urls must parse", () => {
    const c = clone();
    c.site.whatsapp = "https://x.com:99999";
    c.site.socials[0].href = "http://bad host/";
    c.projects[0].href = "https://[::1";
    expect(paths(c)).toEqual(expect.arrayContaining(["site.whatsapp", "site.socials.0.href", "projects.0.href"]));
  });

  it("project image is a local path or an uploaded Blob URL", () => {
    for (const bad of ["https://example.com/a.webp", "//evil.com/a.png", "https://blob.vercel-storage.com/a.png", "https://x.public.blob.vercel-storage.com.evil.com/a.png", "http://x.public.blob.vercel-storage.com/a.png"]) {
      const c = clone();
      c.projects[0].image = bad;
      expect(paths(c), bad).toContain("projects.0.image");
    }
  });

  it("rejects duplicate specialism ids at the id field", () => {
    const c = clone();
    c.specialisms[1].id = c.specialisms[0].id;
    const issues = issuesFor(c);
    expect(issues.some((i) => i.path === "specialisms.1.id")).toBe(true);
  });
});

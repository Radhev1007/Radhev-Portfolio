import type { Metadata } from "next";
import { defaultContent, workPath, type ContentData, type Project, type SiteData } from "@/lib/content";

/**
 * Search and share copy, kept beside the content it describes.
 *
 * The title leads with the name (what people search for) and the role; the
 * description is the positioning statement with the name and region in front,
 * about 155 characters so it is not cut in results.
 */
/**
 * The site's origin for metadata. A stored URL that `new URL` rejects must never throw while a layout
 * renders (that would 500 every route, /admin included), so it falls back to the built-in address.
 */
export function safeSiteUrl(url: string): string {
  return URL.canParse(url) && /^https?:$/.test(new URL(url).protocol) ? new URL(url).origin : defaultContent.site.url;
}

export const fullName = ({ site }: Pick<ContentData, "site">) => `${site.name.first} ${site.name.last}`;
export const seoTitle = (content: Pick<ContentData, "site">) => `${fullName(content)} | Senior UI/UX & Product Designer`;
export const seoDescription = (content: Pick<ContentData, "site">) =>
  `Explore the portfolio of ${fullName(content)}, a Senior UI/UX and Product Designer with 5 years of experience in enterprise SaaS, product design, dashboards and scalable design systems.`;
export const seoKeywords = (content: Pick<ContentData, "site">) => [
  fullName(content),
  "Radhev",
  "Senior UI/UX Designer",
  "Senior Product Designer",
  "UI/UX designer in India",
  "product design",
  "UX designer Kerala",
  "UI designer Kochi",
  "UI/UX designer Trivandrum",
  "enterprise SaaS UX",
  "dashboard design",
  "UX design systems",
  "Figma design systems",
  "user-centred design",
  "usability testing",
  "fintech UX",
  "government platform UX",
  "Figma",
  "portfolio",
];

/** The site-wide metadata (the public layout's), built from the stored content. */
export function siteMetadata(
  content: ContentData,
  inherited: { ogImages?: NonNullable<Metadata["openGraph"]>["images"]; twitterImages?: NonNullable<Metadata["twitter"]>["images"] } = {},
): Metadata {
  const { site } = content;
  const name = fullName(content);
  const title = seoTitle(content);
  const description = seoDescription(content);
  return {
    metadataBase: new URL(safeSiteUrl(site.url)),
    title: { default: title, template: `%s — ${name}` },
    description,
    keywords: seoKeywords(content),
    authors: [{ name, url: safeSiteUrl(site.url) }],
    creator: name,
    applicationName: name,
    category: "design",
    alternates: { canonical: "/" },
    // the share image (app/opengraph-image.tsx) is attached at the root segment and passed in as `inherited`
    openGraph: { type: "profile", url: "/", siteName: name, locale: "en_IN", title, description, firstName: site.name.first, lastName: site.name.last, images: inherited.ogImages },
    twitter: { card: "summary_large_image", title, description, images: inherited.twitterImages },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
    formatDetection: { telephone: false, email: false, address: false },
    // Google Search Console ownership (URL-prefix property https://www.radhev.in/); keep it, or the property unverifies
    verification: { google: "YifXl9A4K9ljMZd9yQOb6AVcJcJu_xLoIV0ysDQIWpM" },
  };
}

const abs = (site: SiteData, path: string) => new URL(path, safeSiteUrl(site.url)).toString();
const personIdOf = (site: SiteData) => `${safeSiteUrl(site.url)}/#person`;

/** The project as a CreativeWork, shared by the home page's `workExample` and the project's own page. */
const creativeWork = (site: SiteData, p: Project) => ({
  "@type": "CreativeWork",
  "@id": `${abs(site, workPath(p))}#work`,
  name: p.title,
  description: p.story.seoDescription,
  url: abs(site, workPath(p)),
  ...(p.image ? { image: abs(site, p.image) } : {}),
  genre: p.categories,
  datePublished: p.story.year,   // when it was published on Behance
  creator: { "@id": personIdOf(site) },
  // the full case study on Behance is the same work
  sameAs: p.href,
});

/**
 * Structured data for the home page: the site, the profile page, and the
 * person it is about — role, region, current employer, skills, profiles
 * elsewhere (`sameAs`) and the selected work. Search engines use it to tie
 * the name to this site and to those profiles.
 */
export function homeJsonLd(content: ContentData) {
  const { site, experience, specialisms, projects } = content;
  const name = fullName(content);
  const personId = personIdOf(site);
  const current = experience.find((r) => r.to === "Present");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${safeSiteUrl(site.url)}/#website`,
        url: abs(site, "/"),
        name,
        description: seoDescription(content),
        inLanguage: "en",
        publisher: { "@id": personId },
      },
      {
        "@type": "ProfilePage",
        "@id": `${safeSiteUrl(site.url)}/#profile`,
        url: abs(site, "/"),
        name: seoTitle(content),
        isPartOf: { "@id": `${safeSiteUrl(site.url)}/#website` },
        mainEntity: { "@id": personId },
        inLanguage: "en",
      },
      {
        "@type": "Person",
        "@id": personId,
        name,
        url: abs(site, "/"),
        image: abs(site, "/radhev-portrait.webp"),
        jobTitle: site.role,
        description: site.statement,
        email: `mailto:${site.email}`,
        address: { "@type": "PostalAddress", addressLocality: "Kollam", addressRegion: "Kerala", addressCountry: "IN" },
        ...(current ? { worksFor: { "@type": "Organization", name: current.company } } : {}),
        knowsAbout: [...specialisms.map((s) => s.title), "UI design", "UX design", "Figma", "Enterprise SaaS", "Dashboard design", "Usability testing", "Fintech"],
        sameAs: site.socials.map((s) => s.href),
        workExample: projects.map((p) => creativeWork(site, p)),
      },
    ],
  };
}

/**
 * Structured data for a project's page: the page, the work it is about
 * (made by the Person defined on the home page, linked by `@id`), and the
 * breadcrumb back to the home page.
 */
export function workJsonLd(content: ContentData, p: Project) {
  const { site } = content;
  const name = fullName(content);
  const personId = personIdOf(site);
  const url = abs(site, workPath(p));
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: p.story.seoTitle,
        description: p.story.seoDescription,
        isPartOf: { "@id": `${safeSiteUrl(site.url)}/#website` },
        mainEntity: { "@id": `${url}#work` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        ...(p.image ? { primaryImageOfPage: abs(site, p.image) } : {}),
        inLanguage: "en",
      },
      { ...creativeWork(site, p), headline: p.title, keywords: p.categories.join(", "), inLanguage: "en" },
      // a stub of the home page's Person, so this page's graph is complete on its own
      { "@type": "Person", "@id": personId, name, url: abs(site, "/") },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name, item: abs(site, "/") },
          { "@type": "ListItem", position: 2, name: p.title, item: url },
        ],
      },
    ],
  };
}

/** JSON for a <script type="application/ld+json">, with "<" escaped so no string can close the tag. */
export const jsonLdString = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

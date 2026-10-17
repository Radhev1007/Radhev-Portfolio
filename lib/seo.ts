import { experience, projects, site, specialisms } from "@/lib/content";

/**
 * Search and share copy, kept beside the content it describes.
 *
 * The title leads with the name (what people search for) and the role; the
 * description is the positioning statement with the name and region in front,
 * about 155 characters so it is not cut in results.
 */
export const fullName = `${site.name.first} ${site.name.last}`;
export const seoTitle = `${fullName} — UI/UX & Product Designer`;
export const seoDescription = `${fullName} is a UI/UX and product designer in Kerala, India, designing enterprise SaaS, government platforms, dashboards, fintech products and design systems.`;
export const seoKeywords = [
  fullName,
  "Radhev",
  "UI/UX designer",
  "product designer",
  "UX designer Kerala",
  "UI designer Kochi",
  "UI/UX designer Trivandrum",
  "enterprise SaaS design",
  "dashboard design",
  "design systems",
  "fintech UX",
  "government platform UX",
  "Figma",
  "portfolio",
];

const abs = (path: string) => new URL(path, site.url).toString();

/**
 * Structured data for the home page: the site, the profile page, and the
 * person it is about — role, region, current employer, skills, profiles
 * elsewhere (`sameAs`) and the selected work. Search engines use it to tie
 * the name to this site and to those profiles.
 */
export function homeJsonLd() {
  const person = `${site.url}/#person`;
  const current = experience.find((r) => r.to === "Present");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${site.url}/#website`,
        url: abs("/"),
        name: fullName,
        description: seoDescription,
        inLanguage: "en",
        publisher: { "@id": person },
      },
      {
        "@type": "ProfilePage",
        "@id": `${site.url}/#profile`,
        url: abs("/"),
        name: seoTitle,
        isPartOf: { "@id": `${site.url}/#website` },
        mainEntity: { "@id": person },
        inLanguage: "en",
      },
      {
        "@type": "Person",
        "@id": person,
        name: fullName,
        url: abs("/"),
        image: abs("/radhev-portrait.webp"),
        jobTitle: site.role,
        description: site.statement,
        email: `mailto:${site.email}`,
        address: { "@type": "PostalAddress", addressLocality: "Kollam", addressRegion: "Kerala", addressCountry: "IN" },
        ...(current ? { worksFor: { "@type": "Organization", name: current.company } } : {}),
        knowsAbout: [...specialisms.map((s) => s.title), "UI design", "UX design", "Figma", "Enterprise SaaS", "Dashboards", "Fintech"],
        sameAs: site.socials.map((s) => s.href),
        workExample: projects.map((p) => ({
          "@type": "CreativeWork",
          name: p.title,
          description: p.description,
          url: p.href,
          ...(p.image ? { image: abs(p.image) } : {}),
          creator: { "@id": person },
        })),
      },
    ],
  };
}

/** JSON for a <script type="application/ld+json">, with "<" escaped so no string can close the tag. */
export const jsonLdString = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

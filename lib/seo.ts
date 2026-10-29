import { experience, projects, site, specialisms, workPath, type Project } from "@/lib/content";

/**
 * Search and share copy, kept beside the content it describes.
 *
 * The title leads with the name (what people search for) and the role; the
 * description is the positioning statement with the name and region in front,
 * about 155 characters so it is not cut in results.
 */
export const fullName = `${site.name.first} ${site.name.last}`;
export const seoTitle = `${fullName} | Senior UI/UX & Product Designer`;
export const seoDescription = `Explore the portfolio of ${fullName}, a Senior UI/UX and Product Designer with 5 years of experience in enterprise SaaS, product design, dashboards and scalable design systems.`;
export const seoKeywords = [
  fullName,
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

const abs = (path: string) => new URL(path, site.url).toString();
const personId = `${site.url}/#person`;

/** The project as a CreativeWork, shared by the home page's `workExample` and the project's own page. */
const creativeWork = (p: Project) => ({
  "@type": "CreativeWork",
  "@id": `${abs(workPath(p))}#work`,
  name: p.title,
  description: p.story.seoDescription,
  url: abs(workPath(p)),
  ...(p.image ? { image: abs(p.image) } : {}),
  genre: p.categories,
  datePublished: p.story.year,   // when it was published on Behance
  creator: { "@id": personId },
  // the full case study on Behance is the same work
  sameAs: p.href,
});

/**
 * Structured data for the home page: the site, the profile page, and the
 * person it is about — role, region, current employer, skills, profiles
 * elsewhere (`sameAs`) and the selected work. Search engines use it to tie
 * the name to this site and to those profiles.
 */
export function homeJsonLd() {
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
        publisher: { "@id": personId },
      },
      {
        "@type": "ProfilePage",
        "@id": `${site.url}/#profile`,
        url: abs("/"),
        name: seoTitle,
        isPartOf: { "@id": `${site.url}/#website` },
        mainEntity: { "@id": personId },
        inLanguage: "en",
      },
      {
        "@type": "Person",
        "@id": personId,
        name: fullName,
        url: abs("/"),
        image: abs("/radhev-portrait.webp"),
        jobTitle: site.role,
        description: site.statement,
        email: `mailto:${site.email}`,
        address: { "@type": "PostalAddress", addressLocality: "Kollam", addressRegion: "Kerala", addressCountry: "IN" },
        ...(current ? { worksFor: { "@type": "Organization", name: current.company } } : {}),
        knowsAbout: [...specialisms.map((s) => s.title), "UI design", "UX design", "Figma", "Enterprise SaaS", "Dashboard design", "Usability testing", "Fintech"],
        sameAs: site.socials.map((s) => s.href),
        workExample: projects.map(creativeWork),
      },
    ],
  };
}

/**
 * Structured data for a project's page: the page, the work it is about
 * (made by the Person defined on the home page, linked by `@id`), and the
 * breadcrumb back to the home page.
 */
export function workJsonLd(p: Project) {
  const url = abs(workPath(p));
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: p.story.seoTitle,
        description: p.story.seoDescription,
        isPartOf: { "@id": `${site.url}/#website` },
        mainEntity: { "@id": `${url}#work` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        ...(p.image ? { primaryImageOfPage: abs(p.image) } : {}),
        inLanguage: "en",
      },
      { ...creativeWork(p), headline: p.title, keywords: p.categories.join(", "), inLanguage: "en" },
      // a stub of the home page's Person, so this page's graph is complete on its own
      { "@type": "Person", "@id": personId, name: fullName, url: abs("/") },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: fullName, item: abs("/") },
          { "@type": "ListItem", position: 2, name: p.title, item: url },
        ],
      },
    ],
  };
}

/** JSON for a <script type="application/ld+json">, with "<" escaped so no string can close the tag. */
export const jsonLdString = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

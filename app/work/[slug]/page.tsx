import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseStudy } from "@/components/CaseStudy/CaseStudy";
import { getProject, projects, site, workPath } from "@/lib/content";
import { fullName, jsonLdString, workJsonLd } from "@/lib/seo";

type Params = { params: Promise<{ slug: string }> };

/** One page per project, all built ahead of time (the static export needs every path listed). */
export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

/** Any other slug is a 404 rather than an on-demand render. */
export const dynamicParams = false;

/**
 * Each page sets its own title, snippet, canonical and share card. The
 * `openGraph` and `twitter` objects replace the layout's whole, so the
 * site-wide fields they need are repeated here; the share image is the
 * project's cover.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const project = getProject((await params).slug);
  if (!project) return {};
  const { seoTitle: title, seoDescription: description } = project.story;
  const url = workPath(project);
  const images = project.image
    ? [{ url: project.image, width: 808, height: 632, alt: project.imageAlt ?? project.title }]
    : undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", url, siteName: fullName, locale: "en_IN", title, description, authors: [site.url], images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function WorkPage({ params }: Params) {
  const project = getProject((await params).slug);
  if (!project) notFound();
  const next = projects[(projects.indexOf(project) + 1) % projects.length];

  return (
    <>
      {/* structured data for search engines: the page, the work and its creator (lib/seo.ts) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(workJsonLd(project)) }} />
      <CaseStudy project={project} next={next} />
    </>
  );
}

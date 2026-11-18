import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseStudy } from "@/components/CaseStudy/CaseStudy";
import { getProject, workPath } from "@/lib/content";
import { getContent } from "@/lib/content-store";
import { fullName, jsonLdString, workJsonLd } from "@/lib/seo";

type Params = { params: Promise<{ slug: string }> };

/** Every project known at build time is built ahead of time (the static export needs every path listed). */
export async function generateStaticParams() {
  const { projects } = await getContent();
  return projects.map((p) => ({ slug: p.slug }));
}

/*
 * No `dynamicParams` export, on purpose. The default (true) lets a project added in the admin after a
 * deploy render on its first request (then it is cached); the page itself calls notFound() for any slug
 * not in the stored content. Next only reads a literal here, and an explicit `true` fails the static
 * export ("dynamicParams: true cannot be used with output: export"), while leaving it unset does not:
 * that build simply has only the slugs from generateStaticParams.
 */

/**
 * Each page sets its own title, snippet, canonical and share card. The
 * `openGraph` and `twitter` objects replace the layout's whole, so the
 * site-wide fields they need are repeated here; the share image is the
 * project's cover.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const content = await getContent();
  const project = getProject(content, (await params).slug);
  if (!project) return {};
  const { site } = content;
  const { seoTitle: title, seoDescription: description } = project.story;
  const url = workPath(project);
  const images = project.image
    ? [{ url: project.image, width: 808, height: 632, alt: project.imageAlt ?? project.title }]
    : undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", url, siteName: fullName(content), locale: "en_IN", title, description, authors: [site.url], images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function WorkPage({ params }: Params) {
  const content = await getContent();
  const { projects } = content;
  const project = getProject(content, (await params).slug);
  if (!project) notFound();
  const next = projects[(projects.indexOf(project) + 1) % projects.length];

  return (
    <>
      {/* structured data for search engines: the page, the work and its creator (lib/seo.ts) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(workJsonLd(content, project)) }} />
      <CaseStudy project={project} next={next} />
    </>
  );
}

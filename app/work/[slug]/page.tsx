import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseStudy } from "@/components/CaseStudy/CaseStudy";
import { getCaseStudy, getProject, projects } from "@/lib/content";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const project = getProject((await params).slug);
  return project ? { title: project.title, description: project.description } : {};
}

export default async function CaseStudyPage({ params }: Params) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const i = projects.indexOf(project);
  const next = projects[(i + 1) % projects.length];

  return <CaseStudy project={project} sections={getCaseStudy(project)} next={next} />;
}

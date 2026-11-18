"use client";

import type { Project } from "@/lib/content";
import type { Updater } from "@/lib/admin/updaters";
import { ListEditor } from "../ListEditor";
import { ProjectEditor } from "./ProjectEditor";

const blankProject = (): Project => ({
  slug: "",
  href: "",
  number: "",
  title: "",
  categories: [],
  description: "",
  role: "",
  story: { seoTitle: "", seoDescription: "", published: "", year: "", tools: [], overview: [], screens: [], decisions: [], scope: "" },
  visual: "web",
  palette: { from: "#1F2937", to: "#111827", ink: "#F9FAFB" },
});

export function ProjectsSection({ value, update }: { value: Project[]; update: Updater<Project[]> }) {
  return (
    <ListEditor
      path="projects"
      title="Projects"
      description="In the order they appear on the home page. Open a project to edit its card and its case study."
      noun="project"
      collapsible
      confirmRemove
      items={value}
      update={update}
      create={blankProject}
      itemLabel={(p, i) => (p.title ? `${p.number ? `${p.number} · ` : ""}${p.title}` : `Project ${i + 1}`)}
      renderItem={(p, _i, up, path, alive) => <ProjectEditor value={p} update={up} path={path} alive={alive} />}
    />
  );
}

"use client";

import { forwardRef } from "react";
import type { ContentData } from "@/lib/content";
import type { Issue } from "./api";

const WORDS: Record<string, string> = {
  site: "Site info",
  projects: "Project",
  experience: "Role",
  specialisms: "Specialism",
  processSteps: "Process step",
  story: "case study",
  heroTitle: "headline",
  heroCtas: "hero buttons",
  secondary: "second button",
  socials: "profile",
  seoTitle: "search title",
  seoDescription: "search description",
  imageAlt: "alt text",
  href: "link",
  n: "number",
  availabilityLabel: "availability label",
  points: "point",
  tools: "tool",
  overview: "paragraph",
  screens: "screen",
  decisions: "decision",
  categories: "category",
};

const word = (s: string) => WORDS[s] ?? s.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

/** "projects.2.story.tools.0" -> "Project 3 (Title) › case study › tool 1". */
export function describePath(content: ContentData, path: string): string {
  const parts = path.split(".");
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    const next = parts[i + 1];
    if (next !== undefined && /^\d+$/.test(next)) {
      let label = `${word(seg)} ${Number(next) + 1}`;
      if (i === 0 && seg === "projects") {
        const title = content.projects[Number(next)]?.title;
        if (title) label += ` (${title})`;
      }
      out.push(label[0].toUpperCase() + label.slice(1));
      i++;
    } else out.push(word(seg));
  }
  return out.join(" › ");
}

/** The list of problems from a rejected save, each a button that jumps to its field. */
export const IssueSummary = forwardRef<HTMLDivElement, { issues: Issue[]; content: ContentData; onGo: (path: string) => void }>(
  function IssueSummary({ issues, content, onGo }, ref) {
    return (
      <div ref={ref} tabIndex={-1} role="alert" className="rounded-lg border-2 border-red-700 bg-red-50 p-4">
        <h2 className="text-base font-semibold tracking-normal text-red-900">
          Not saved: {issues.length === 1 ? "1 field needs" : `${issues.length} fields need`} attention
        </h2>
        <ul className="mt-2 grid gap-1">
          {issues.map((issue) => (
            <li key={issue.path + issue.message}>
              <button
                type="button"
                className="min-h-11 text-left text-sm text-red-900 underline underline-offset-2 hover:no-underline"
                onClick={() => onGo(issue.path)}
              >
                <span className="font-semibold">{describePath(content, issue.path) || "Content"}</span>: {issue.message}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  },
);

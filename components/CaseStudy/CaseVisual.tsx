"use client";

import { motion } from "framer-motion";
import { ProjectVisual } from "@/components/ProjectCard/ProjectVisual";
import type { CaseSectionVisual, Project } from "@/lib/content";
import { ease, viewportOnce } from "@/lib/motion";

/**
 * Placeholder artefacts for each case-study chapter. Swap any of these for
 * real images (e.g. <Image src="/images/projects/<slug>/flow.png" … />).
 */
export function CaseVisual({ kind, project }: { kind: Exclude<CaseSectionVisual, "none">; project: Project }) {
  const accent = project.palette.to;
  const frame = "rounded-[24px] border border-line bg-ink-2";

  switch (kind) {
    case "insights":
      return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {["[Insight one — what people need]", "[Insight two — where they struggle]", "[Insight three — what they value]"].map((t, i) => (
            <div key={i} className={`${frame} flex min-h-56 flex-col justify-between p-7`}>
              <span className="font-accent text-6xl" style={{ color: accent }}>
                {i + 1}
              </span>
              <p className="text-lg leading-snug text-bone/80">{t}</p>
            </div>
          ))}
        </div>
      );

    case "ia":
      return (
        <div className={`${frame} overflow-x-auto p-8 no-scrollbar`}>
          <div className="flex min-w-[640px] flex-col items-center gap-10">
            <Node label="Home" strong accent={accent} />
            <div className="grid w-full grid-cols-4 gap-4 border-t border-line pt-10">
              {["[Section]", "[Section]", "[Section]", "[Section]"].map((s, i) => (
                <div key={i} className="flex flex-col items-center gap-3">
                  <Node label={s} />
                  {Array.from({ length: 3 - (i % 2) }, (_, j) => (
                    <span key={j} className="h-8 w-full rounded-lg border border-dashed border-bone/15" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case "flow":
      return (
        <div className={`${frame} overflow-x-auto p-8 no-scrollbar`}>
          <ol className="flex min-w-[720px] items-center">
            {["Entry", "[Step]", "[Decision]", "[Step]", "Success"].map((s, i, arr) => (
              <li key={i} className="flex flex-1 items-center">
                <motion.span
                  className={`grid h-20 flex-1 place-items-center border text-sm ${i === 2 ? "rotate-0 rounded-[40%]" : "rounded-2xl"} ${
                    i === arr.length - 1 ? "text-ink" : "border-line text-bone/80"
                  }`}
                  style={i === arr.length - 1 ? { background: accent, borderColor: accent } : undefined}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={viewportOnce}
                  transition={{ delay: i * 0.12, duration: 0.8, ease: ease.outExpo }}
                >
                  {s}
                </motion.span>
                {i < arr.length - 1 && (
                  <motion.span
                    className="mx-2 h-px w-10 origin-left bg-bone/40"
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={viewportOnce}
                    transition={{ delay: i * 0.12 + 0.2, duration: 0.6 }}
                  />
                )}
              </li>
            ))}
          </ol>
        </div>
      );

    case "wireframes":
      return (
        <div className="grid grid-cols-3 gap-3 md:gap-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-[9/16] rounded-[20px] bg-[#e9e6df] p-3 md:p-5">
              <div className="h-3 w-1/2 rounded bg-black/15" />
              <div className="mt-4 h-1/3 rounded-lg border-2 border-dashed border-black/20" />
              <div className="mt-4 space-y-2">
                {[100, 80, 90, 60].map((w, j) => (
                  <div key={j} className="h-2 rounded bg-black/10" style={{ width: `${w - i * 5}%` }} />
                ))}
              </div>
              <div className="mt-6 h-8 w-2/3 rounded-full bg-black/70" />
            </div>
          ))}
        </div>
      );

    case "visual":
      return (
        <div className="relative aspect-[16/10] overflow-hidden rounded-[24px]">
          <ProjectVisual project={project} />
        </div>
      );

    case "tokens":
      return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className={`${frame} p-7`}>
            <p className="label mb-5">Colour</p>
            <div className="grid grid-cols-4 gap-3">
              {[project.palette.from, accent, project.palette.ink, "#000000"].map((c) => (
                <div key={c}>
                  <div className="aspect-square rounded-xl border border-line" style={{ background: c }} />
                  <p className="mt-2 font-mono text-[10px] uppercase text-bone/50">{c}</p>
                </div>
              ))}
            </div>
          </div>
          <div className={`${frame} p-7`}>
            <p className="label mb-5">Type scale</p>
            {[48, 32, 20, 15].map((s) => (
              <p key={s} className="flex items-baseline justify-between border-b border-line py-2 last:border-0" style={{ fontSize: s * 0.8 }}>
                <span className="tracking-[-0.03em]">Aa Display</span>
                <span className="font-mono text-[10px] text-bone/40">{s}px</span>
              </p>
            ))}
          </div>
          <div className={`${frame} flex flex-wrap items-center gap-3 p-7 md:col-span-2`}>
            <p className="label w-full">Components</p>
            <span className="rounded-full px-6 py-3 text-sm text-ink" style={{ background: accent }}>Primary</span>
            <span className="rounded-full border border-bone/30 px-6 py-3 text-sm">Secondary</span>
            <span className="rounded-full bg-ink-3 px-6 py-3 text-sm text-bone/50">Disabled</span>
            <span className="relative h-8 w-14 rounded-full" style={{ background: accent }}>
              <span className="absolute right-1 top-1 size-6 rounded-full bg-white" />
            </span>
            <span className="flex h-12 min-w-56 items-center rounded-xl border border-line px-4 text-sm text-bone/40">Input field</span>
          </div>
        </div>
      );

    case "prototype":
      return (
        <div className={`${frame} flex items-center justify-center gap-4 overflow-hidden p-8 md:gap-8 md:p-14`}>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="relative aspect-[9/19] w-1/4 max-w-[220px] rounded-[28px] border-4 border-black bg-ink-3 p-2 shadow-2xl"
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: i === 1 ? -20 : 0, opacity: 1 }}
              viewport={viewportOnce}
              transition={{ delay: i * 0.12, duration: 1, ease: ease.outExpo }}
            >
              <div className="h-1/3 rounded-[20px]" style={{ background: `linear-gradient(135deg, ${project.palette.from}, ${accent})` }} />
              <div className="mt-3 space-y-2 px-1">
                <div className="h-2 w-3/4 rounded bg-bone/30" />
                <div className="h-2 w-1/2 rounded bg-bone/15" />
              </div>
              <div className="absolute inset-x-3 bottom-4 h-7 rounded-full" style={{ background: i === 1 ? accent : "var(--color-line)" }} />
            </motion.div>
          ))}
        </div>
      );

    case "outcome":
      return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {["[Verified result]", "[Verified result]", "[Qualitative feedback]"].map((t, i) => (
            <div key={i} className={`${frame} p-7`}>
              <p className="text-6xl font-medium tracking-[-0.05em] text-bone/25">—</p>
              <p className="mt-6 text-bone/70">{t}</p>
            </div>
          ))}
        </div>
      );
  }
}

function Node({ label, strong, accent }: { label: string; strong?: boolean; accent?: string }) {
  return (
    <span
      className={`rounded-xl border px-5 py-3 text-sm ${strong ? "text-ink" : "border-line text-bone/80"}`}
      style={strong ? { background: accent, borderColor: accent } : undefined}
    >
      {label}
    </span>
  );
}

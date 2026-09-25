"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Arrow } from "@/components/Animations/Button";
import { Reveal } from "@/components/Animations/Reveal";
import { TextReveal } from "@/components/Animations/TextReveal";
import { ProjectVisual } from "@/components/ProjectCard/ProjectVisual";
import { useProjectTransition } from "@/components/Providers/ProjectTransition";
import { useScrollTo } from "@/components/Providers/SmoothScroll";
import type { CaseSection, Project } from "@/lib/content";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { ease } from "@/lib/motion";
import { CaseVisual } from "./CaseVisual";

type Props = { project: Project; sections: CaseSection[]; next: Project };

export function CaseStudy({ project, sections, next }: Props) {
  return (
    <main id="main">
      <CaseHero project={project} />
      <div className="gutter mx-auto grid max-w-[1600px] grid-cols-1 gap-12 py-24 md:grid-cols-12 md:py-36">
        <CaseIndex sections={sections} />
        <div className="flex flex-col gap-32 md:col-span-9 md:col-start-4 md:gap-44">
          {sections.map((s, i) => (
            <CaseBlock key={s.id} section={s} index={i} project={project} />
          ))}
        </div>
      </div>
      <NextProject project={next} />
    </main>
  );
}

/* ── Hero: identical full-bleed artwork to the transition overlay ── */
function CaseHero({ project }: { project: Project }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const inset = useTransform(scrollYProgress, [0, 1], reduced ? ["inset(0% 0% 0% 0% round 0px)", "inset(0% 0% 0% 0% round 0px)"] : ["inset(0% 0% 0% 0% round 0px)", "inset(8% 6% 8% 6% round 32px)"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, reduced ? 1 : 1.12]);
  const titleY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : -120]);

  return (
    <section ref={ref} aria-label={project.title} className="relative h-[100svh] min-h-[600px]">
      <motion.div className="sticky top-0 h-[100svh] overflow-hidden" style={{ clipPath: inset }}>
        <motion.div className="absolute inset-0" style={{ scale }}>
          <ProjectVisual project={project} priority sizes="100vw" />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/10" />
      </motion.div>

      <motion.div className="absolute inset-x-0 bottom-0 gutter pb-10 md:pb-14" style={{ y: titleY }}>
        <div className="mx-auto max-w-[1600px]">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.9, ease: ease.outExpo }}>
            <Link href="/#work" className="label inline-flex items-center gap-2 !text-bone/80 hover:!text-bone">
              <Arrow className="size-3 rotate-180" /> All work
            </Link>
          </motion.div>
          <TextReveal
            as="h1"
            immediate
            delay={0.35}
            text={project.title}
            className="mt-6 max-w-[16ch] text-[clamp(2.75rem,8vw,8.5rem)] font-medium leading-[0.9] tracking-[-0.05em]"
          />
          <motion.dl
            className="mt-10 grid grid-cols-2 gap-6 border-t border-bone/15 pt-6 text-sm md:grid-cols-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 1 }}
          >
            {[
              ["Project", project.number],
              ["Role", project.role],
              ["Discipline", project.categories.join(", ")],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="label mb-1">{k}</dt>
                <dd className="text-bone/90">{v}</dd>
              </div>
            ))}
          </motion.dl>
        </div>
      </motion.div>
    </section>
  );
}

/* ── Sticky chapter index ─────────────────────────────────── */
function CaseIndex({ sections }: { sections: CaseSection[] }) {
  const [active, setActive] = useState(sections[0].id);
  const scrollTo = useScrollTo();

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-40% 0px -55% 0px" },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [sections]);

  return (
    <nav aria-label="Case study sections" className="hidden md:col-span-3 md:block">
      <ol className="sticky top-28 flex flex-col gap-1">
        {sections.map((s, i) => {
          const on = s.id === active;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo(s.id);
                }}
                aria-current={on ? "true" : undefined}
                className={`flex items-center gap-3 py-1 text-sm transition-colors duration-500 ${on ? "text-bone" : "text-bone/35 hover:text-bone/70"}`}
              >
                <span className={`h-px transition-all duration-500 ${on ? "w-8 bg-accent" : "w-3 bg-bone/25"}`} />
                <span className="font-mono text-[11px]">{String(i + 1).padStart(2, "0")}</span>
                {s.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function CaseBlock({ section, index, project }: { section: CaseSection; index: number; project: Project }) {
  return (
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-28">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-9">
        <div className="lg:col-span-3">
          <p className="label">{String(index + 1).padStart(2, "0")} — {section.label}</p>
        </div>
        <div className="lg:col-span-6">
          <h2 id={`${section.id}-title`} className="text-[clamp(2rem,4vw,3.75rem)] font-medium leading-[0.95] tracking-[-0.045em]">
            {section.title}
          </h2>
          <Reveal>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-bone/70">{section.body}</p>
          </Reveal>
          {section.points && (
            <ul className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
              {section.points.map((p, i) => (
                <li key={i} className="flex items-center gap-4 bg-ink p-5 text-bone/80">
                  <span className="label">{String(i + 1).padStart(2, "0")}</span>
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {section.visual !== "none" && (
        <Reveal blur className="mt-12">
          <CaseVisual kind={section.visual} project={project} />
        </Reveal>
      )}
    </section>
  );
}

/* ── Next project: the transition loops back into itself ───── */
function NextProject({ project }: { project: Project }) {
  const cover = useRef<HTMLDivElement>(null);
  const { open } = useProjectTransition();

  return (
    <section aria-label="Next project" className="gutter mx-auto max-w-[1600px] pb-28">
      <Link
        href={`/work/${project.slug}`}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || !cover.current) return;
          e.preventDefault();
          open(project, cover.current);
        }}
        data-cursor="view"
        data-cursor-label="Next"
        className="group block"
      >
        <div className="flex items-end justify-between border-t border-line pt-8">
          <div>
            <p className="label">Next project — {project.number}</p>
            <p className="mt-4 text-[clamp(2.25rem,6vw,6rem)] font-medium leading-[0.95] tracking-[-0.05em] transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:translate-x-4">
              {project.title}
            </p>
          </div>
          <span className="mb-3 hidden size-16 place-items-center rounded-full border border-line transition-all duration-500 group-hover:-rotate-45 group-hover:bg-bone group-hover:text-ink md:grid">
            <Arrow />
          </span>
        </div>
        <div ref={cover} className="relative mt-10 aspect-[16/7] overflow-hidden rounded-[28px]">
          <div className="absolute inset-0 transition-transform duration-[1.2s] ease-[var(--ease-out-expo)] group-hover:scale-105">
            <ProjectVisual project={project} sizes="100vw" />
          </div>
        </div>
      </Link>
    </section>
  );
}

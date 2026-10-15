"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Parallax } from "@/components/Animations/Parallax";
import { Reveal } from "@/components/Animations/Reveal";
import { ProjectCard } from "@/components/ProjectCard/ProjectCard";
import { projects, type Project } from "@/lib/content";
import { TextReveal } from "@/components/Animations/TextReveal";
import { useScrollTo } from "@/components/Providers/SmoothScroll";
import { SectionHeader } from "./SectionHeader";

/** What the work spans, shown under the heading. */
const focusAreas = ["Enterprise SaaS", "Dashboards", "Government", "Mobile", "Design systems"];

export function Projects() {
  const [active, setActive] = useState<Project | null>(null);
  const scrollTo = useScrollTo();

  return (
    <section id="work" aria-label="Selected work" className="relative">
      {/* A flat colour wash that shifts to the focused project's palette */}
      <motion.div
        aria-hidden
        className="pointer-events-none sticky top-0 -mb-[100svh] h-[100svh] w-full"
        animate={{ backgroundColor: active ? `${active.palette.to}14` : "#00000000" }}
        transition={{ duration: 0.9 }}
      />

      {/* The padding lives here, not on the section: `surface-invert` paints
          this element, so padding on the parent sits outside the white and
          leaves the header flush against its top edge. */}
      <div className="surface-invert relative gutter mx-auto max-w-[1600px] section-y">
        <SectionHeader index="01" label="Selected Work" count={projects.length} />

        {/* Heading on the left; on the right, what the work is and an index
            of it, so the header previews the section instead of only
            announcing it. */}
        <div className="mt-8 grid grid-cols-1 gap-12 md:mt-12 md:grid-cols-12 md:gap-8">
          <Parallax speed={30} className="md:col-span-6">
            <h2 className="section-title">
              <TextReveal as="span" text="Selected" className="block" />
              <TextReveal as="span" text="Work" delay={0.1} className="block font-accent text-bone/60" />
            </h2>
            <ul className="mt-12 flex flex-wrap gap-2 md:mt-16">
              {focusAreas.map((area) => (
                <li key={area} className="label rounded-control border border-line px-3 py-2 !text-bone">
                  {area}
                </li>
              ))}
            </ul>
          </Parallax>

          <Reveal className="md:col-span-5 md:col-start-8 md:self-end" delay={0.2}>
            <p className="section-intro">
              A selection of complex digital products, enterprise platforms and interfaces I&apos;ve
              designed.
            </p>

            <ol className="mt-12 border-b border-line md:mt-16">
              {projects.map((p) => (
                <li key={p.slug} className="border-t border-line">
                  <button
                    type="button"
                    onClick={() => scrollTo(`project-${p.slug}`)}
                    onMouseEnter={() => setActive(p)}
                    onMouseLeave={() => setActive(null)}
                    data-cursor="view"
                    className="group flex w-full items-center gap-5 py-4 text-left"
                  >
                    <span className="label tabular-nums transition-colors duration-300 group-hover:!text-accent">
                      {p.number}
                    </span>
                    <span className="flex-1 text-body font-medium tracking-[-0.01em] transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-1">
                      {p.title}
                    </span>
                    <span className="label hidden sm:inline">{p.categories[1]}</span>
                    <span
                      aria-hidden
                      className="text-mute transition-all duration-300 group-hover:translate-y-0.5 group-hover:text-accent"
                    >
                      ↓
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>

        <div className="mt-16 flex flex-col gap-28 md:mt-24 md:gap-44">
          {projects.map((p, i) => (
            <ProjectCard key={p.slug} project={p} index={i} onActive={setActive} />
          ))}
        </div>
      </div>
    </section>
  );
}

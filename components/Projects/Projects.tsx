"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Parallax } from "@/components/Animations/Parallax";
import { Reveal } from "@/components/Animations/Reveal";
import { ProjectCard } from "@/components/ProjectCard/ProjectCard";
import { projects, type Project } from "@/lib/content";
import { TextReveal } from "@/components/Animations/TextReveal";
import { SectionHeader } from "./SectionHeader";

export function Projects() {
  const [active, setActive] = useState<Project | null>(null);

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

        {/* Heading on the left; on the right, what the work is. */}
        <div className="mt-8 grid grid-cols-1 gap-12 md:mt-12 md:grid-cols-12 md:gap-8">
          <Parallax speed={30} className="md:col-span-6">
            <h2 className="section-title">
              <TextReveal as="span" text="Selected" className="block" />{" "}
              <TextReveal as="span" text="Work" delay={0.1} className="block font-accent text-bone/60" />
            </h2>
          </Parallax>

          <Reveal className="md:col-span-5 md:col-start-8 md:self-end" delay={0.2}>
            <p className="section-intro">
              A selection of complex digital products, enterprise platforms and interfaces I&apos;ve
              designed.
            </p>
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

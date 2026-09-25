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
    <section id="work" aria-label="Selected work" className="relative py-28 md:py-44">
      {/* A flat colour wash that shifts to the focused project's palette */}
      <motion.div
        aria-hidden
        className="pointer-events-none sticky top-0 -mb-[100svh] h-[100svh] w-full"
        animate={{ backgroundColor: active ? `${active.palette.to}14` : "#00000000" }}
        transition={{ duration: 0.9 }}
      />

      <div className="relative gutter mx-auto max-w-[1600px]">
        <SectionHeader index="02" label="Selected Work" count={projects.length} />

        <div className="mt-10 grid grid-cols-1 gap-10 md:mt-16 md:grid-cols-12 md:items-end">
          <Parallax speed={60} className="md:col-span-7">
            <h2 className="text-[clamp(3rem,9vw,9rem)] leading-[0.88]">
              <TextReveal as="span" text="Selected" className="block font-medium tracking-[-0.05em]" />
              <TextReveal as="span" text="Work" delay={0.1} className="block font-accent text-bone/85" />
            </h2>
          </Parallax>
          <Reveal className="md:col-span-4 md:col-start-9" delay={0.2}>
            <p className="max-w-md text-base leading-relaxed text-bone/65">
              A selection of digital products, platforms, and experiences designed around people, business goals, and
              meaningful interactions.
            </p>
          </Reveal>
        </div>

        <div className="mt-20 flex flex-col gap-28 md:mt-32 md:gap-44">
          {projects.map((p, i) => (
            <ProjectCard key={p.slug} project={p} index={i} onActive={setActive} />
          ))}
        </div>
      </div>
    </section>
  );
}

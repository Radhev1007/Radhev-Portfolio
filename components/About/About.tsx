"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Parallax } from "@/components/Animations/Parallax";
import { Reveal } from "@/components/Animations/Reveal";
import { TextReveal } from "@/components/Animations/TextReveal";
import { SectionHeader } from "@/components/Projects/SectionHeader";
import { about } from "@/lib/content";
import { LayerStack } from "./LayerStack";

const headlineStyles = [
  "font-medium",
  "font-accent text-bone/90 tracking-[-0.03em]",
  "text-outline font-medium",
];

export function About() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const drift = useTransform(scrollYProgress, [0, 1], [60, -60]);

  return (
    <section id="about" ref={ref} aria-label="About" className="relative gutter mx-auto max-w-[1600px] py-28 md:py-44">
      <SectionHeader index="05" label="About" />

      <Parallax speed={50}>
      <h2 className="mt-12 text-[clamp(2.6rem,7.2vw,8rem)] leading-[0.9] tracking-[-0.05em] md:mt-20">
        {about.headline.map((line, i) => (
          <TextReveal key={line} as="span" text={line} delay={i * 0.12} className={`block ${headlineStyles[i]}`} />
        ))}
      </h2>
      </Parallax>

      <div className="mt-16 grid grid-cols-1 gap-16 md:mt-28 md:grid-cols-12 md:gap-8">
        {/* Spatial composition: the layers of an interface, exploded */}
        <motion.div className="overflow-x-clip md:col-span-6 lg:col-span-7" style={{ y: drift }}>
          <LayerStack />
        </motion.div>

        <div className="flex flex-col gap-12 md:col-span-6 lg:col-span-5">
          <Reveal>
            <p className="text-[clamp(1.25rem,1.9vw,1.75rem)] leading-[1.35] tracking-[-0.015em] text-bone/90">{about.intro}</p>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-md text-base leading-relaxed text-bone/55">{about.secondary}</p>
          </Reveal>

          <div>
            <p className="label mb-4">Disciplines</p>
            <ul className="border-t border-line">
              {about.disciplines.map((d, i) => (
                <Reveal key={d} delay={i * 0.05}>
                  <li className="group flex items-center justify-between border-b border-line py-4 transition-colors duration-500 hover:text-accent">
                    <span className="text-lg tracking-tight transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-2">
                      {d}
                    </span>
                    <span className="label">0{i + 1}</span>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

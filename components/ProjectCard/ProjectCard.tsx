"use client";

import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Arrow } from "@/components/Animations/Button";
import { useProjectTransition } from "@/components/Providers/ProjectTransition";
import type { Project } from "@/lib/content";
import { useFinePointer, usePrefersReducedMotion } from "@/lib/hooks";
import { useTheme } from "@/lib/theme";
import { ease, viewportOnce } from "@/lib/motion";
import { ProjectVisual } from "./ProjectVisual";

type Props = { project: Project; index: number; onActive: (p: Project | null) => void };

/**
 * One project as a mini-experience: a large, clip-revealed cover that
 * drifts gently toward the cursor, with an artwork layer that
 * parallaxes independently and metadata that unfolds on hover.
 */
export function ProjectCard({ project, index, onActive }: Props) {
  const root = useRef<HTMLElement>(null);
  const cover = useRef<HTMLDivElement>(null);
  const fine = useFinePointer();
  const reduced = usePrefersReducedMotion();
  const interactive = fine && !reduced;
  const { open } = useProjectTransition();
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  // Project accent that stays legible on the current theme's background.
  const accent = useTheme() === "light" ? project.palette.from : project.palette.to;
  const flip = index % 2 === 1;

  // Pointer-driven tilt + drift
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 140, damping: 20, mass: 0.6 };
  const driftX = useSpring(useTransform(px, [-0.5, 0.5], [-14, 14]), spring);
  const driftY = useSpring(useTransform(py, [-0.5, 0.5], [-10, 10]), spring);
  const fgX = useSpring(useTransform(px, [-0.5, 0.5], [-26, 26]), spring);
  const fgY = useSpring(useTransform(py, [-0.5, 0.5], [-18, 18]), spring);

  // Scroll-linked inner parallax
  const { scrollYProgress } = useScroll({ target: root, offset: ["start end", "end start"] });
  const innerScale = useTransform(scrollYProgress, [0, 0.5, 1], reduced ? [1, 1, 1] : [1.18, 1.04, 1.1]);
  const titleX = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : flip ? [-40, 40] : [40, -40]);

  const onMove = (e: React.PointerEvent) => {
    if (!interactive || !cover.current) return;
    const r = cover.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const enter = () => {
    router.prefetch(`/work/${project.slug}`);
    setHovered(true);
    onActive(project);
  };
  const leave = () => {
    setHovered(false);
    onActive(null);
    px.set(0);
    py.set(0);
  };

  const href = `/work/${project.slug}`;
  const onOpen = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || !cover.current) return;
    e.preventDefault();
    open(project, cover.current);
  };

  return (
    <motion.article
      ref={root}
      className="relative grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8"
      onViewportEnter={() => !fine && onActive(project)}
      viewport={{ margin: "-45% 0px -45% 0px" }}
    >
      {/* Cover */}
      <div className={`md:col-span-8 ${flip ? "md:order-2 md:col-start-5 md:row-start-1" : ""}`}>
        <Link
          href={href}
          onClick={onOpen}
          onPointerMove={onMove}
          onPointerEnter={enter}
          onPointerLeave={leave}
          onFocus={enter}
          onBlur={leave}
          data-cursor="view"
          aria-label={`Open case study: ${project.title}`}
          className="block"
        >
          <motion.div
            style={interactive ? { x: driftX, y: driftY } : undefined}
          >
            <motion.div
              ref={cover}
              className="relative aspect-[5/4] overflow-hidden rounded-[20px] bg-ink-3 sm:aspect-[16/10] md:rounded-[28px]"
              initial={{ clipPath: reduced ? "inset(0% 0% 0% 0% round 28px)" : "inset(12% 8% 12% 8% round 28px)" }}
              whileInView={{ clipPath: "inset(0% 0% 0% 0% round 28px)" }}
              viewport={viewportOnce}
              transition={{ duration: 1.4, ease: ease.outExpo }}
            >
              <motion.div className="absolute inset-0" style={{ scale: innerScale }}>
                <motion.div
                  className="absolute inset-0"
                  animate={{ scale: hovered ? 1.04 : 1 }}
                  transition={{ duration: 1, ease: ease.outExpo }}
                >
                  <ProjectVisual project={project} fgX={interactive ? fgX : undefined} fgY={interactive ? fgY : undefined} />
                </motion.div>
              </motion.div>
              <div className="absolute left-5 top-5 flex gap-2 md:left-7 md:top-7">
                {project.categories.slice(0, 2).map((c) => (
                  <span key={c} className="glass rounded-full px-3 py-1.5 text-[11px] font-medium tracking-wide">
                    {c}
                  </span>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </Link>
      </div>

      {/* Meta */}
      <div className={`flex flex-col justify-between gap-6 md:col-span-4 md:py-4 ${flip ? "md:order-1 md:col-start-1 md:row-start-1" : ""}`}>
        <div className="flex items-start justify-between md:flex-col md:gap-6">
          <span className="label">Project {project.number}</span>
          <span
            aria-hidden
            className="font-accent text-[clamp(4rem,9vw,9rem)] leading-[0.8] text-mute transition-colors duration-700"
            style={hovered ? { color: accent } : undefined}
          >
            {project.number}
          </span>
        </div>

        <div className="flex flex-col gap-5">
          <motion.h3
            className="text-[clamp(1.9rem,3.2vw,3.25rem)] font-medium leading-[1] tracking-[-0.035em]"
            style={{ x: interactive ? titleX : 0 }}
          >
            <Link href={href} onClick={onOpen} className="focus-visible:outline-offset-8" data-cursor="view">
              {project.title}
            </Link>
          </motion.h3>
          <p className="text-sm text-bone/60">{project.categories.join(" · ")}</p>

          <motion.div
            className="grid overflow-hidden"
            initial={false}
            animate={{ gridTemplateRows: hovered || !interactive ? "1fr" : "0fr", opacity: hovered || !interactive ? 1 : 0.0 }}
            transition={{ duration: 0.7, ease: ease.outExpo }}
          >
            <div className="min-h-0">
              <p className="max-w-sm pt-1 text-[15px] leading-relaxed text-bone/75">{project.description}</p>
            </div>
          </motion.div>

          <dl className="grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm">
            <div>
              <dt className="label mb-1">Discipline</dt>
              <dd>{project.categories[0]}</dd>
            </div>
            <div>
              <dt className="label mb-1">Role</dt>
              <dd>{project.role}</dd>
            </div>
          </dl>

          <span className="flex items-center gap-3 text-sm" aria-hidden>
            <span
              className="grid size-10 place-items-center rounded-full border border-line transition-all duration-500"
              style={hovered ? { background: "var(--color-bone)", color: "var(--color-ink)", transform: "rotate(-45deg)" } : undefined}
            >
              <Arrow />
            </span>
            View case study
          </span>
        </div>
      </div>
    </motion.article>
  );
}

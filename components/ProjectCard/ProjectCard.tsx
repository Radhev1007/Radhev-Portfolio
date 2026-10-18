"use client";

import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef, useState } from "react";
import { Arrow } from "@/components/Animations/Button";
import { workPath, type Project } from "@/lib/content";
import { useFinePointer, usePrefersReducedMotion } from "@/lib/hooks";
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
  const [hovered, setHovered] = useState(false);
  // Project accent, chosen to stay legible on the page's dark ground.
  const accent = project.palette.to;
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
  const innerScale = useTransform(scrollYProgress, [0, 0.5, 1], reduced ? [1, 1, 1] : [1.06, 1, 1.04]);
  const titleX = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : flip ? [-40, 40] : [40, -40]);

  const onMove = (e: React.PointerEvent) => {
    if (!interactive || !cover.current) return;
    const r = cover.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const enter = () => {
    setHovered(true);
    onActive(project);
  };
  const leave = () => {
    setHovered(false);
    onActive(null);
    px.set(0);
    py.set(0);
  };

  // The cover and title open the project's own page; the full case study on
  // Behance is linked beside them, one click away.
  const page = workPath(project);

  return (
    <motion.article
      ref={root}
      id={`project-${project.slug}`}
      className="relative grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8"
      onViewportEnter={() => !fine && onActive(project)}
      viewport={{ margin: "-45% 0px -45% 0px" }}
    >
      {/* Cover */}
      <div className={`md:col-span-8 ${flip ? "md:order-2 md:col-start-5 md:row-start-1" : ""}`}>
        <Link
          href={page}
          onPointerMove={onMove}
          onPointerEnter={enter}
          onPointerLeave={leave}
          onFocus={enter}
          onBlur={leave}
          data-cursor="view"
          className="block"
        >
          {/* the link's name, read before the visible category chips (an aria-label would hide them, and the
              accessible name must contain the text people see) */}
          <span className="sr-only">Open case study: {project.title}</span>
          <motion.div
            style={interactive ? { x: driftX, y: driftY } : undefined}
          >
            <motion.div
              ref={cover}
              className="relative aspect-[3/2] overflow-hidden rounded-card bg-ink-3"
              initial={{ clipPath: reduced ? "inset(0% 0% 0% 0%)" : "inset(12% 8% 12% 8%)" }}
              whileInView={{ clipPath: "inset(0% 0% 0% 0%)" }}
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
              <div className="absolute left-4 top-4 flex gap-2 md:left-6 md:top-6">
                {[...(project.status ? [project.status] : []), ...project.categories.slice(0, 2)].map((c) => (
                  <span key={c} className="glass rounded-control px-3 py-2 text-caption font-medium tracking-wide">
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
          {/* drawn from data-n by CSS: the label beside it already says the number, once */}
          <span
            aria-hidden
            data-n={project.number}
            className="font-accent text-display leading-[0.8] text-mute transition-colors duration-700 before:content-[attr(data-n)]"
            style={hovered ? { color: accent } : undefined}
          />
        </div>

        <div className="flex flex-col gap-4">
          <motion.h3
            className="text-item font-normal leading-[1.1] tracking-[-0.03em]"
            style={{ x: interactive ? titleX : 0 }}
          >
            <Link href={page} className="focus-visible:outline-offset-8" data-cursor="view">
              {project.title}
            </Link>
          </motion.h3>
          <p className="text-small text-bone/60">{project.categories.join(" · ")}</p>

          <motion.div
            className="grid overflow-hidden"
            initial={false}
            animate={{ gridTemplateRows: hovered || !interactive ? "1fr" : "0fr", opacity: hovered || !interactive ? 1 : 0.0 }}
            transition={{ duration: 0.7, ease: ease.outExpo }}
          >
            <div className="min-h-0">
              <p className="max-w-sm pt-2 text-small leading-relaxed text-bone/75">{project.description}</p>
            </div>
          </motion.div>

          <dl className="grid grid-cols-2 gap-4 border-t border-line pt-4 text-small">
            <div>
              <dt className="label mb-2">Discipline</dt>
              <dd>{project.categories[0]}</dd>
            </div>
            <div>
              <dt className="label mb-2">Role</dt>
              <dd>{project.role}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-small">
            {/* a tap target for touch and mouse (it looked like a button but did nothing on a phone); keyboard and
                screen-reader users reach the same page through the cover and title links, so it is skipped by both */}
            <Link href={page} tabIndex={-1} aria-hidden data-cursor="view" className="flex items-center gap-2">
              <span
                className="grid size-10 place-items-center rounded-full border border-line transition-all duration-500"
                style={hovered ? { background: "var(--color-bone)", color: "var(--color-ink)", transform: "rotate(-45deg)" } : undefined}
              >
                <Arrow />
              </span>
              View project
            </Link>
            <a
              href={project.href}
              target="_blank"
              rel="noreferrer"
              className="text-bone/70 underline decoration-line underline-offset-4 transition-colors duration-300 hover:text-bone hover:decoration-accent"
            >
              <span className="sr-only">{project.title}: </span>All screens on Behance ↗
            </a>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

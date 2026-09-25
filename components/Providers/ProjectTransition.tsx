"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ProjectVisual } from "@/components/ProjectCard/ProjectVisual";
import type { Project } from "@/lib/content";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { ease } from "@/lib/motion";
import { useLenis } from "./SmoothScroll";

type Rect = { top: number; left: number; width: number; height: number; radius: number };
type Pending = { project: Project; rect: Rect; phase: "expanding" | "arrived" };

type Ctx = { open: (project: Project, el: HTMLElement) => void; active: boolean };

const TransitionContext = createContext<Ctx>({ open: () => {}, active: false });
export const useProjectTransition = () => useContext(TransitionContext);

/**
 * Shared-element transition from a project cover to its case study:
 *  1. clone the cover at its on-screen rect,
 *  2. expand it (position + size + radius) to fill the viewport,
 *  3. navigate while the clone covers the page,
 *  4. fade the clone once the case-study hero — which renders the same
 *     artwork full-bleed — has mounted underneath it.
 */
export function ProjectTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const reduced = usePrefersReducedMotion();
  const lenis = useLenis();
  const [pending, setPending] = useState<Pending | null>(null);

  const open = useCallback(
    (project: Project, el: HTMLElement) => {
      const href = `/work/${project.slug}`;
      if (reduced) {
        router.push(href);
        return;
      }
      const r = el.getBoundingClientRect();
      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      lenis?.stop();
      setPending({ project, rect: { top: r.top, left: r.left, width: r.width, height: r.height, radius }, phase: "expanding" });
      router.prefetch(href);
    },
    [reduced, router, lenis],
  );

  // Once the destination route renders, release the overlay.
  useEffect(() => {
    if (pending?.phase !== "arrived" || !pathname.startsWith(`/work/${pending.project.slug}`)) return;
    const t = setTimeout(() => setPending(null), 120);
    return () => clearTimeout(t);
  }, [pathname, pending]);

  const onExpanded = () => {
    if (!pending || pending.phase !== "expanding") return;
    lenis?.start();
    setPending({ ...pending, phase: "arrived" });
    router.push(`/work/${pending.project.slug}`, { scroll: false });
  };

  return (
    <TransitionContext.Provider value={{ open, active: !!pending }}>
      {children}
      <AnimatePresence>
        {pending && (
          <motion.div
            key={pending.project.slug}
            className="pointer-events-none fixed z-[90] overflow-hidden"
            initial={{
              top: pending.rect.top,
              left: pending.rect.left,
              width: pending.rect.width,
              height: pending.rect.height,
              borderRadius: pending.rect.radius,
            }}
            animate={{ top: 0, left: 0, width: "100vw", height: "100svh", borderRadius: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.5, ease: ease.outQuart } }}
            transition={{ duration: 1, ease: ease.inOutQuart }}
            onAnimationComplete={onExpanded}
          >
            <ProjectVisual project={pending.project} priority sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/10" />
          </motion.div>
        )}
      </AnimatePresence>
    </TransitionContext.Provider>
  );
}

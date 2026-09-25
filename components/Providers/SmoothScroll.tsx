"use client";

import { MotionConfig } from "framer-motion";
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks";

const LenisContext = createContext<Lenis | null>(null);

export const useLenis = () => useContext(LenisContext);

/** Scrolls to an element id using Lenis when available, native otherwise. */
export function useScrollTo() {
  const lenis = useLenis();
  return (id: string) => {
    const target = id === "home" ? 0 : document.getElementById(id);
    if (target === null) return;
    if (lenis) lenis.scrollTo(target, { duration: 1.4, offset: 0 });
    else if (target === 0) window.scrollTo({ top: 0 });
    else target.scrollIntoView();
  };
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduced = usePrefersReducedMotion();
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    if (reduced) return;
    const instance = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
    let frame = requestAnimationFrame(function raf(time) {
      instance.raf(time);
      frame = requestAnimationFrame(raf);
    });
    setLenis(instance);
    if (process.env.NODE_ENV === "development") (window as unknown as { __lenis?: Lenis }).__lenis = instance;
    return () => {
      cancelAnimationFrame(frame);
      instance.destroy();
      setLenis(null);
    };
  }, [reduced]);

  // On every route change: land at the top (or on the #hash target) and
  // resync Lenis with the new document height.
  const pathname = usePathname();
  useEffect(() => {
    const id = window.location.hash.slice(1);
    const frame = requestAnimationFrame(() => {
      lenis?.resize();
      const target = id ? document.getElementById(id) : null;
      if (target) {
        if (lenis) lenis.scrollTo(target, { immediate: true, force: true });
        else target.scrollIntoView();
      } else {
        window.scrollTo(0, 0);
        lenis?.scrollTo(0, { immediate: true, force: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, lenis]);

  // reducedMotion="user": framer-motion drops transform animations for
  // visitors who prefer reduced motion, keeping only gentle opacity fades.
  return (
    <MotionConfig reducedMotion="user">
      <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>
    </MotionConfig>
  );
}

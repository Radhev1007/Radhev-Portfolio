"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ScrambleText } from "@/components/Animations/ScrambleText";
import { useLenis } from "@/components/Providers/SmoothScroll";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { ease, INTRO_HOLD } from "@/lib/motion";

/**
 * The opening screen, once per page load. On black, the logo assembles from
 * pixels — each pops in at its own moment and settles into the r, the accent
 * foot last — the wordmark decodes beneath it, and a hairline progress bar runs
 * to 100%. Then the screen lifts away as five panels, one after another, and
 * the hero's entrance (timed from INTRO_HOLD, lib/motion) plays as it is
 * revealed.
 *
 * The page is rendered underneath the whole time, so search engines and the
 * page-speed metrics see the content at once; only scrolling waits. Reduced
 * motion gets the finished logo and a short fade.
 */
const PANELS = 5;
const GRID = 2;   // logo units per pixel (the mark is 50 × 56 units)

// the mark's shapes, in its own units (as components/Chrome/Logo and app/icon.svg)
const STEM = "M26 24h17v56H26z";
const SHOULDER = "M36 24h12a28 28 0 0 1 28 28H59a11 11 0 0 0-11-11H36z";
const FOOT = "M26 68h17v12H26z";

function PixelLogo({ size, still }: { size: number; still: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current, ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), cols = 50 / GRID, rows = 56 / GRID;
    const px = size / cols, w = cols * px, h = rows * px;
    cv.width = w * dpr; cv.height = h * dpr; cv.style.width = `${w}px`; cv.style.height = `${h}px`;
    const probe = document.createElement("canvas").getContext("2d")!;
    const [stem, shoulder, foot] = [STEM, SHOULDER, FOOT].map((d) => new Path2D(d));   // (browser only)
    // which cells the mark covers, and when each appears (the foot after the rest)
    const cells: { x: number; y: number; accent: boolean; at: number }[] = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const ux = 26 + (x + 0.5) * GRID, uy = 24 + (y + 0.5) * GRID;
      const accent = probe.isPointInPath(foot, ux, uy);
      if (accent || probe.isPointInPath(stem, ux, uy) || probe.isPointInPath(shoulder, ux, uy)) {
        cells.push({ x, y, accent, at: accent ? 0.75 + Math.random() * 0.25 : Math.random() * 0.7 + (1 - y / rows) * 0.05 });
      }
    }
    const DUR = 1.25;
    let raf = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      const t = still ? 99 : (now - t0) / 1000 / DUR;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      for (const c of cells) {
        const k = Math.min(1, Math.max(0, (t - c.at) / 0.18));
        if (k <= 0) continue;
        const s = px * (0.35 + 0.65 * (1 - (1 - k) ** 3)) - 1;   // grows into place
        ctx.globalAlpha = k;
        ctx.fillStyle = c.accent ? "#f43c00" : "#ffffff";
        ctx.fillRect(c.x * px + (px - s) / 2, c.y * px + (px - s) / 2, s, s);
      }
      if (t < 1.3) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, still]);
  return <canvas ref={ref} />;
}

export function IntroLoader() {
  const reduced = usePrefersReducedMotion();
  const lenis = useLenis();
  const [open, setOpen] = useState(true);
  const bar = useRef<HTMLDivElement>(null);
  const pct = useRef<HTMLSpanElement>(null);

  // hold scrolling while the screen is up
  useEffect(() => {
    if (!open) return;
    lenis?.stop();
    const html = document.documentElement, prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { lenis?.start(); html.style.overflow = prev; };
  }, [open, lenis]);

  // progress, then lift the screen
  useEffect(() => {
    const total = (reduced ? 0.6 : INTRO_HOLD) * 1000, t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / total), eased = 1 - (1 - k) ** 3;
      if (bar.current) bar.current.style.transform = `scaleX(${eased})`;
      if (pct.current) pct.current.textContent = `${Math.round(eased * 100)}%`;
      if (k < 1) raf = requestAnimationFrame(tick);
      else setOpen(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="intro" aria-hidden className="pointer-events-auto fixed inset-0 z-[250]" exit={{ opacity: reduced ? 0 : 1 }} transition={{ duration: reduced ? 0.4 : 1.1 }}>
          {/* the screen: panels that lift one after another */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: PANELS }, (_, i) => (
              <motion.div
                key={i}
                className="h-full flex-1 bg-ink"
                exit={reduced ? {} : { y: "-100%" }}
                transition={{ duration: 0.8, ease: ease.inOutQuart, delay: i * 0.06 }}
              />
            ))}
          </div>

          <motion.div
            className="relative flex h-full flex-col items-center justify-center gap-7 text-bone"
            exit={reduced ? {} : { opacity: 0, y: -24 }}
            transition={{ duration: 0.45, ease: ease.inOutQuart }}
          >
            <PixelLogo size={92} still={reduced} />
            <span className="text-small font-medium uppercase tracking-[0.42em] text-bone/85">
              <ScrambleText text="Radhev R" onMount={!reduced} stagger={2.2} />
            </span>
          </motion.div>

          {/* hairline progress */}
          <motion.div
            className="absolute inset-x-0 bottom-0 gutter pb-6"
            exit={reduced ? {} : { opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-3 flex justify-between font-mono text-[0.75rem] uppercase tracking-[0.14em] text-mute">
              <span>UI/UX &amp; Product Designer</span>
              <span ref={pct} className="tabular-nums text-bone">0%</span>
            </div>
            <div className="h-px w-full bg-bone/15">
              <div ref={bar} className="h-full w-full origin-left bg-accent" style={{ transform: "scaleX(0)" }} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

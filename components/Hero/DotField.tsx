"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks";

/**
 * The hero's ground: a fine dot grid in the accent, a few artboard guides,
 * embers drifting up through it, and a warm glow along the top edge.
 *
 * Only the embers are drawn in JavaScript. The grid and the guides are CSS —
 * a repeating radial-gradient and four dashed boxes — which costs nothing to
 * paint and stays crisp at any density, so the canvas carries a hundred-odd
 * circles rather than a value per cell of the whole viewport.
 *
 * The field runs at 30fps, and only while the hero is on screen and the tab
 * is visible. Reduced motion gets one still frame. Purely decorative: inert
 * and hidden from assistive tech.
 */
/* Space separated, so it drops into the `rgb(... / a)` slash syntax. Commas
   plus a slash is invalid and the whole declaration is thrown away. */
const ACCENT = "244 60 0";

/** Quieter under the written column, and gone by the time the next section arrives. */
const MASK =
  "linear-gradient(to bottom, black 74%, transparent 97%), linear-gradient(to right, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.82) 45%, black 75%)";

/** One ember per this many square pixels of hero. */
const AREA_PER_EMBER = 15000;

type Ember = {
  x: number;
  y: number;
  r: number;
  /** Brightness at the top of its twinkle. */
  a: number;
  /** Pixels per second, upward. */
  vy: number;
  phase: number;
  /** Radians per second of twinkle. */
  rate: number;
};

export function DotField({ cell = 16 }: { cell?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = box.current, cv = canvas.current;
    if (!el || !cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let w = 0, h = 0, embers: Ember[] = [];

    const make = (y?: number): Ember => {
      // A handful are larger and brighter, so the field has a few foreground
      // sparks rather than one uniform dusting.
      const big = Math.random() < 0.18;
      return {
        x: Math.random() * w,
        y: y ?? Math.random() * h,
        r: big ? 2.2 + Math.random() * 1.4 : 0.9 + Math.random() * 1.1,
        a: big ? 0.55 + Math.random() * 0.4 : 0.2 + Math.random() * 0.35,
        vy: 3 + Math.random() * 11,
        phase: Math.random() * Math.PI * 2,
        rate: 0.4 + Math.random() * 1.1,
      };
    };

    const size = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.width = `${w}px`; cv.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      embers = Array.from({ length: Math.round((w * h) / AREA_PER_EMBER) }, () => make());
    };
    size();

    const pointer = { x: -1e4, y: -1e4, glow: 0 };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
    };
    const onLeave = () => { pointer.x = pointer.y = -1e4; };

    const draw = (t: number, dt: number) => {
      ctx.clearRect(0, 0, w, h);
      pointer.glow += ((pointer.x > -1e3 ? 1 : 0) - pointer.glow) * 0.08;

      for (const p of embers) {
        p.y -= p.vy * dt;
        if (p.y < -p.r * 2) Object.assign(p, make(h + p.r * 2));

        let a = p.a * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * p.rate + p.phase)));

        // Embers near the pointer come up, so the field answers the cursor.
        const dx = p.x - pointer.x, dy = p.y - pointer.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 140) a += (1 - dist / 140) ** 2 * 0.6 * pointer.glow;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${ACCENT} / ${Math.min(1, a).toFixed(3)})`;
        ctx.fill();
      }
    };

    if (reduced) {
      const still = () => { size(); draw(0, 0); };
      still();
      const ro = new ResizeObserver(still);
      ro.observe(el);
      return () => ro.disconnect();
    }

    let raf = 0, last = 0, prev = performance.now() / 1000, visible = true;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden || now - last < 33) return;   // ~30fps, and only while it can be seen
      last = now;
      const t = now / 1000;
      // Clamped: a backgrounded tab resumes with one huge delta otherwise,
      // which would teleport every ember off the top.
      const dt = Math.min(0.1, t - prev);
      prev = t;
      draw(t, dt);
    };
    raf = requestAnimationFrame(loop);

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      prev = performance.now() / 1000;   // don't bank drift while it was away
    });
    io.observe(el);
    const ro = new ResizeObserver(size);
    ro.observe(el);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [reduced]);

  return (
    <div ref={box} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* The grid everything else is measured against. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(rgb(${ACCENT} / 0.42) 1px, transparent 1px)`,
          backgroundSize: `${cell}px ${cell}px`,
          maskImage: MASK,
          WebkitMaskImage: MASK,
          maskComposite: "intersect",
          WebkitMaskComposite: "source-in",
        }}
      />

      {/* Artboard guides: the frames a layout gets drawn inside, left showing.
          Phone width is too narrow for them to read as a layout rather than as
          stray lines, so they start at md. */}
      <div className="absolute inset-0 hidden md:block">
        <div className="absolute -left-24 top-[18%] h-[52%] w-[34%] border border-dashed border-bone/[0.1]" />
        <div className="absolute left-[30%] top-[8%] h-[76%] w-[44%] border border-dashed border-bone/[0.07]" />
        <div className="absolute -right-32 top-[26%] h-[46%] w-[32%] border border-dashed border-bone/[0.1]" />
      </div>

      <canvas
        ref={canvas}
        className="absolute left-0 top-0"
        style={{ maskImage: MASK, WebkitMaskImage: MASK, maskComposite: "intersect", WebkitMaskComposite: "source-in" }}
      />

      {/* The warm edge the page opens on. */}
      <div
        className="absolute inset-x-0 top-0 h-[280px]"
        style={{ background: `linear-gradient(to bottom, rgb(${ACCENT} / 0.26), rgb(${ACCENT} / 0.07) 42%, transparent)` }}
      />
    </div>
  );
}

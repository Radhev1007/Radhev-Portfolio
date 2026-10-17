"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks";

/**
 * A dot-matrix field behind the hero: a grid of square pixels, dim at rest,
 * lit by slow drifting waves, the odd pixel blinking (a few in the accent),
 * and a soft glow that follows the pointer.
 *
 * It is drawn one value per cell into a tiny canvas that the browser scales up
 * without smoothing, so each cell is one solid block; a CSS grid of ink lines
 * on top cuts the blocks apart into pixels. That keeps a full-screen field to a
 * few thousand writes per frame at 30 fps. It only animates while the hero is
 * on screen and the tab is visible, and holds a single still frame for anyone
 * who has asked for reduced motion. Purely decorative: inert and hidden from
 * assistive tech.
 */
const ACCENT = [244, 60, 0];
const WHITE = [255, 255, 255];
const MASK = "linear-gradient(to bottom, black 50%, transparent 92%), linear-gradient(to right, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.6) 40%, black 70%)";

export function PixelField({ cell = 14, gap = 4 }: { cell?: number; gap?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = box.current, cv = canvas.current;
    if (!el || !cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let cols = 0, rows = 0, img: ImageData | null = null, seeds = new Float32Array(0);
    const size = () => {
      const r = el.getBoundingClientRect();
      cols = Math.ceil(r.width / cell) + 1;
      rows = Math.ceil(r.height / cell) + 1;
      cv.width = cols; cv.height = rows;
      cv.style.width = `${cols * cell}px`; cv.style.height = `${rows * cell}px`;
      img = ctx.createImageData(cols, rows);
      // per-pixel randoms: blink rate, blink phase, accent or not
      seeds = new Float32Array(cols * rows * 3);
      for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    };
    size();

    const pointer = { x: -1e4, y: -1e4, glow: 0 };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.x = (e.clientX - r.left) / cell;
      pointer.y = (e.clientY - r.top) / cell;
    };

    const draw = (t: number) => {
      if (!img) return;
      const d = img.data;
      pointer.glow += ((pointer.x > -1e3 ? 1 : 0) - pointer.glow) * 0.08;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x, s = i * 3;
          // two slow interfering waves: soft bands of light drifting across the grid
          const w = Math.sin(x * 0.16 + t * 0.55) * Math.sin(y * 0.13 - t * 0.35) + Math.sin((x + y) * 0.07 - t * 0.28);
          let a = 0.03 + Math.max(0, w * 0.5) ** 3 * 0.1;
          // the odd pixel blinks: a short sharp peak once in a while
          a += Math.max(0, Math.sin(t * (0.4 + seeds[s] * 1.2) + seeds[s + 1] * 60)) ** 40 * 0.4;
          // pointer glow
          const dx = x - pointer.x, dy = y - pointer.y, dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 8) a += (1 - dist / 8) ** 2 * 0.32 * pointer.glow;
          const c = seeds[s + 2] < 0.01 ? ACCENT : WHITE;
          const o = i * 4;
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2];
          d[o + 3] = Math.min(255, a * (c === ACCENT ? 1.7 : 1) * 255);
        }
      }
      ctx.putImageData(img, 0, 0);
    };

    if (reduced) {
      draw(12);
      const ro = new ResizeObserver(() => { size(); draw(12); });
      ro.observe(el);
      return () => ro.disconnect();
    }

    let raf = 0, last = 0, visible = true;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden || now - last < 33) return;   // ~30 fps, and only while it can be seen
      last = now;
      draw(now / 1000);
    };
    raf = requestAnimationFrame(loop);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(el);
    const ro = new ResizeObserver(size);
    ro.observe(el);
    window.addEventListener("pointermove", onMove, { passive: true });
    const onLeave = () => { pointer.x = pointer.y = -1e4; };
    document.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [cell, reduced]);

  return (
    <div
      ref={box}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      // quieter behind the headline (left) and fading out at the bottom, into the next section
      style={{ maskImage: MASK, WebkitMaskImage: MASK, maskComposite: "intersect", WebkitMaskComposite: "source-in" }}
    >
      <canvas ref={canvas} className="absolute left-0 top-0 [image-rendering:pixelated]" />
      {/* ink lines between the cells turn the scaled-up blocks into separate pixels */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to right, var(--color-ink) ${gap}px, transparent ${gap}px), linear-gradient(to bottom, var(--color-ink) ${gap}px, transparent ${gap}px)`,
          backgroundSize: `${cell}px ${cell}px`,
        }}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks";

/**
 * A design-tool canvas behind the hero, in pixels: a faint dot grid, and on it
 * little pieces of interface — cursors, toggles, buttons, checkboxes, sliders,
 * selection frames with handles, image placeholders, text blocks, a layout
 * grid, a "like" — that assemble pixel by pixel, hold, and dissolve, a few at
 * a time, mostly on the artwork's side. The pointer gets a soft hover glow.
 *
 * It is drawn one value per cell into a tiny canvas that the browser scales up
 * without smoothing, so each cell is one solid block; a CSS grid of ink lines
 * on top cuts the blocks apart into pixels. A full-screen field is a few
 * thousand writes per frame at 30 fps, only while the hero is on screen and the
 * tab is visible. Reduced motion gets one still frame. Purely decorative:
 * inert and hidden from assistive tech.
 */
const ACCENT = [244, 60, 0];
const WHITE = [255, 255, 255];
const MASK = "linear-gradient(to bottom, black 50%, transparent 92%), linear-gradient(to right, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.55) 40%, black 70%)";

// pixel-art UI pieces: X bright, x dim, A accent, . off
const GLYPHS: string[][] = [
  // cursor
  ["X.......", "XX......", "XAX.....", "XAAX....", "XAAAX...", "XAAAAX..", "XAAAAAX.", "XAAAXXXX", "XAXAX...", "XX.XAX..", "X...XX.."],
  // toggle, on
  ["..AAAAAAA..", ".AAAAAAXXX.", "AAAAAAXXXXX", ".AAAAAAXXX.", "..AAAAAAA.."],
  // button with a label
  ["XXXXXXXXXXXXXXX", "X.............X", "X..XXXXXXXXX..X", "X.............X", "XXXXXXXXXXXXXXX"],
  // primary button, filled
  ["AAAAAAAAAAAAAAA", "AAAAAAAAAAAAAAA", "AAAXXXXXXXXXAAA", "AAAAAAAAAAAAAAA", "AAAAAAAAAAAAAAA"],
  // checkbox, ticked
  ["XXXXXXX", "X....AX", "X...A.X", "XA.A..X", "X.A...X", "X.....X", "XXXXXXX"],
  // slider
  [".......XXX.....", "AAAAAAAXXXxxxxx", ".......XXX....."],
  // selection frame with handles
  ["XX.AAAAAAA.XX", "XX.........XX", "A...........A", "A...xxxxx...A", "A...........A", "A...xxx.....A", "A...........A", "XX.........XX", "XX.AAAAAAA.XX"],
  // image placeholder
  ["XXXXXXXXXXX", "X.........X", "X......A..X", "X.........X", "X...x.....X", "X..xxx..x.X", "X.xxxxxxxxX", "XXXXXXXXXXX"],
  // text block
  ["XXXXXXXXXXX..", ".............", "xxxxxxxxxxxxx", ".............", "xxxxxxxx....."],
  // layout grid
  ["xxxx.xxxx", "xxxx.xxxx", "xxxx.xxxx", ".........", "xxxx.AAAA", "xxxx.AAAA", "xxxx.AAAA"],
  // like
  [".AA.AA.", "AAAAAAA", "AAAAAAA", ".AAAAA.", "..AAA..", "...A..."],
  // radio buttons
  [".XXX.....xxx.", "XAAAX...x...x", "XAAAX...x...x", ".XXX.....xxx."],
];
const LIFE = 5.5, IN = 0.9, OUT = 0.9;   // seconds: whole life, assembling, dissolving

type Piece = { g: string[]; x: number; y: number; t0: number };

export function PixelField({ cell = 7, gap = 2 }: { cell?: number; gap?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = box.current, cv = canvas.current;
    if (!el || !cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let cols = 0, rows = 0, img: ImageData | null = null, rnd = new Float32Array(0);
    let pieces: Piece[] = [], nextAt = 0;
    const size = () => {
      const r = el.getBoundingClientRect();
      cols = Math.ceil(r.width / cell) + 1;
      rows = Math.ceil(r.height / cell) + 1;
      cv.width = cols; cv.height = rows;
      cv.style.width = `${cols * cell}px`; cv.style.height = `${rows * cell}px`;
      img = ctx.createImageData(cols, rows);
      rnd = new Float32Array(cols * rows);
      for (let i = 0; i < rnd.length; i++) rnd[i] = Math.random();
      pieces = [];
    };
    size();

    // a new piece somewhere free: kept off the bottom (which fades out), clear of the others, and clear of
    // anything in the hero marked data-pixel-avoid (the text and the artwork), in cells
    const avoid = () => {
      const r0 = el.getBoundingClientRect();
      return [...(el.parentElement?.querySelectorAll("[data-pixel-avoid]") ?? [])].map((n) => {
        const r = n.getBoundingClientRect();
        return { x0: (r.left - r0.left) / cell - 1, y0: (r.top - r0.top) / cell - 1, x1: (r.right - r0.left) / cell + 1, y1: (r.bottom - r0.top) / cell + 1 };
      });
    };
    const spawn = (t: number) => {
      const g = GLYPHS[Math.floor(Math.random() * GLYPHS.length)], h = g.length, w = g[0].length, keepOut = avoid();
      for (let tries = 0; tries < 24; tries++) {
        const x = 1 + Math.floor(Math.random() * Math.max(1, cols - w - 2));
        const top = Math.ceil(96 / cell);   // below the navigation bar
        const y = top + Math.floor(Math.random() * Math.max(1, rows * 0.75 - h - top));
        const free = (a: { x0: number; y0: number; x1: number; y1: number }) => x + w < a.x0 || a.x1 < x || y + h < a.y0 || a.y1 < y;
        const clear = keepOut.every(free) && pieces.every((p) => free({ x0: p.x - 2, y0: p.y - 2, x1: p.x + p.g[0].length + 2, y1: p.y + p.g.length + 2 }));
        if (clear) { pieces.push({ g, x, y, t0: t }); return; }
      }
    };

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
      // the canvas: faint dots, a slow breath across them, a soft hover glow
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x, o = i * 4;
          let a = 0.03 + Math.max(0, Math.sin(x * 0.09 + y * 0.05 - t * 0.4)) ** 4 * 0.035;
          const dx = x - pointer.x, dy = y - pointer.y, dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 6) a += (1 - dist / 6) ** 2 * 0.22 * pointer.glow;
          d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = a * 255;
        }
      }
      // the interface pieces: each pixel switches on at its own moment while a piece assembles, and off
      // again while it dissolves
      pieces = pieces.filter((p) => t - p.t0 < LIFE);
      for (const p of pieces) {
        const age = t - p.t0;
        for (let gy = 0; gy < p.g.length; gy++) {
          const row = p.g[gy];
          for (let gx = 0; gx < row.length; gx++) {
            const ch = row[gx];
            if (ch === ".") continue;
            const x = p.x + gx, y = p.y + gy;
            if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
            const i = y * cols + x, r = rnd[i];
            const on = age > r * IN && age < LIFE - OUT + r * OUT;
            if (!on) continue;
            const c = ch === "A" ? ACCENT : WHITE, o = i * 4;
            const a = ch === "x" ? 0.22 : ch === "A" ? 0.75 : 0.5;
            d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = Math.max(d[o + 3], a * 255);
          }
        }
      }
      ctx.putImageData(img, 0, 0);
    };

    // a still frame: a handful of pieces fully assembled
    const still = () => {
      size();
      for (let k = 0; k < 6; k++) spawn(-IN - 1);
      draw(0);
    };

    if (reduced) {
      still();
      const ro = new ResizeObserver(still);
      ro.observe(el);
      return () => ro.disconnect();
    }

    let raf = 0, last = 0, visible = true;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden || now - last < 33) return;   // ~30 fps, and only while it can be seen
      last = now;
      const t = now / 1000;
      if (t > nextAt && pieces.length < (cols > 120 ? 7 : 4)) { spawn(t); nextAt = t + 0.7 + Math.random() * 0.8; }
      draw(t);
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

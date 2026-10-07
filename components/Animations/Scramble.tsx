"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\<>[]{}#*$%&@";

type Props = {
  text: string;
  className?: string;
  /** Seconds before the decode starts. */
  delay?: number;
  /** Seconds the whole string takes to resolve. */
  duration?: number;
  /** Re-run whenever the element is hovered. */
  scrambleOnHover?: boolean;
};

/**
 * Decode-on-entry text, as on the reference sites: every character cycles
 * through random glyphs, then settles left to right.
 *
 * Progress is derived from elapsed time rather than a frame count, so a
 * throttled rAF (background tab, hidden pane) slows the animation instead
 * of stranding it mid-scramble; a final timeout guarantees the landing.
 *
 * The real string stays in the DOM for screen readers — only an
 * aria-hidden layer scrambles — so the accessible name never flickers.
 */
export function Scramble({ text, className, delay = 0, duration = 0.6, scrambleOnHover = false }: Props) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(text);
  const raf = useRef<number | undefined>(undefined);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const stop = useCallback(() => {
    if (raf.current !== undefined) cancelAnimationFrame(raf.current);
    raf.current = undefined;
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const run = useCallback(() => {
    stop();
    const start = performance.now();
    const ms = duration * 1000;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const settled = Math.floor(p * text.length);
      setShown(
        text
          .split("")
          .map((c, i) => (c === " " ? " " : i < settled ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0]))
          .join(""),
      );
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setShown(text);
    };
    raf.current = requestAnimationFrame(tick);

    // Safety net: land on the real string even if frames stop arriving.
    timers.current.push(
      setTimeout(() => {
        stop();
        setShown(text);
      }, ms + 400),
    );
  }, [text, duration, stop]);

  useEffect(() => {
    if (reduced) {
      setShown(text);
      return;
    }
    const t = setTimeout(run, delay * 1000);
    timers.current.push(t);
    return stop;
  }, [run, stop, reduced, text, delay]);

  return (
    <span className={className} onMouseEnter={scrambleOnHover && !reduced ? run : undefined}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="whitespace-pre">
        {shown}
      </span>
    </span>
  );
}

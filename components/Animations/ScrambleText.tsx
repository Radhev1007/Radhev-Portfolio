"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks";

/**
 * Text that decodes itself: every letter cycles through random characters and
 * settles on the real one, left to right (after aino.agency's menu). It plays
 * when the link or button it sits in is hovered or focused, and once on mount
 * with `onMount`.
 *
 * While it plays, the real text keeps the width (made transparent) and the
 * scramble is drawn over it, so a proportional typeface never makes the layout
 * jitter; at rest the element is just the text, for screen readers and search
 * engines alike. `inPlace` swaps the letters directly instead, for wrapping
 * text in a monospace face (where widths cannot change); `stagger` is the steps
 * between one letter settling and the next (lower for long text). Nothing plays
 * for reduced motion.
 */
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const MARKS = "0123456789#%&*+=/<>?!";
const FRAME = 32;   // ms per step
const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
const noise = (c: string) =>
  c === " " ? " " : Math.random() < 0.3 ? pick(MARKS) : c === c.toUpperCase() && c !== c.toLowerCase() ? pick(UPPER) : pick(LOWER);

export function ScrambleText({ text, onMount = false, inPlace = false, stagger = 1.6, className }: {
  text: string;
  onMount?: boolean;
  inPlace?: boolean;
  stagger?: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState<string | null>(null);   // the scramble while it plays, else null

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    let timer = 0;
    const play = () => {
      clearInterval(timer);
      let step = 0;
      const total = text.length * stagger + 6;
      timer = window.setInterval(() => {
        step++;
        // letter i settles after ~4 + 1.6·i steps; until then it shows a fresh random character each step
        setShown(text.split("").map((c, i) => (step >= 4 + i * stagger ? c : noise(c))).join(""));
        if (step >= total) { clearInterval(timer); setShown(null); }
      }, FRAME);
    };
    const host = el.closest("a, button") ?? el;
    host.addEventListener("pointerenter", play);
    host.addEventListener("focus", play);
    if (onMount) play();
    return () => {
      clearInterval(timer);
      host.removeEventListener("pointerenter", play);
      host.removeEventListener("focus", play);
    };
  }, [text, onMount, reduced, stagger]);

  if (inPlace) return <span ref={ref} className={className}>{shown ?? text}</span>;
  return (
    <span ref={ref} className={`relative inline-block whitespace-nowrap ${className ?? ""}`}>
      <span className={shown === null ? undefined : "text-transparent"}>{text}</span>
      {shown !== null && (
        <span aria-hidden className="absolute left-0 top-0">
          {shown}
        </span>
      )}
    </span>
  );
}

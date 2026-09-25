"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useFinePointer, usePrefersReducedMotion } from "@/lib/hooks";
import { ease } from "@/lib/motion";

export type CursorState = "default" | "hover" | "view" | "cta" | "drag";

const SIZES: Record<CursorState, number> = {
  default: 12,
  hover: 44,
  view: 96,
  cta: 64,
  drag: 84,
};

const LABELS: Partial<Record<CursorState, string>> = {
  view: "View",
  drag: "Drag",
};

/**
 * Custom cursor driven by `data-cursor` attributes:
 *   data-cursor="view" | "cta" | "drag" | "hover"
 *   data-cursor-label="Open"   (optional label override)
 * Links and buttons fall back to the "hover" state automatically.
 */
export function Cursor() {
  const fine = useFinePointer();
  const reduced = usePrefersReducedMotion();
  const enabled = fine && !reduced;

  const dotRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<CursorState>("default");
  const [label, setLabel] = useState<string | undefined>();
  const [visible, setVisible] = useState(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.classList.add("has-custom-cursor");

    const target = { x: -100, y: -100 };
    const current = { x: -100, y: -100 };
    let frame = 0;

    const loop = () => {
      current.x += (target.x - current.x) * 0.22;
      current.y += (target.y - current.y) * 0.22;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${current.x}px, ${current.y}px, 0)`;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      setVisible(true);
    };
    const onOver = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>("[data-cursor], a, button, [role='button']");
      const next = (el?.dataset.cursor as CursorState | undefined) ?? (el ? "hover" : "default");
      setState(next);
      setLabel(el?.dataset.cursorLabel);
    };
    const onLeave = () => setVisible(false);
    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);

    return () => {
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove("has-custom-cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, [enabled]);

  if (!enabled) return null;

  const active = { state, label };
  const size = SIZES[active.state];
  const text = active.label ?? LABELS[active.state];
  const filled = active.state === "view" || active.state === "drag";

  return (
    <div
      ref={dotRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[100]"
      style={{ transform: "translate3d(-100px,-100px,0)" }}
    >
      <motion.div
        // Colours come from theme tokens via classes (CSS-transitioned); size/visibility are animated.
        className={`flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-solid transition-[background-color,border-color] duration-300 ${
          filled || active.state === "default"
            ? "border-0 bg-bone"
            : active.state === "cta"
              ? "border border-accent/90 bg-accent/20"
              : "border border-bone/55 bg-bone/10"
        }`}
        initial={false}
        animate={{
          width: size,
          height: size,
          opacity: visible ? 1 : 0,
          scale: pressed ? 0.85 : 1,
        }}
        transition={{ duration: 0.45, ease: ease.outExpo }}
      >
        {text && (
          <motion.span
            key={text}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: ease.outExpo }}
            className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-ink"
          >
            {text}
          </motion.span>
        )}
      </motion.div>
    </div>
  );
}

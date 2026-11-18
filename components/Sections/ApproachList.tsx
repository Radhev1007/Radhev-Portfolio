"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useFinePointer, usePrefersReducedMotion } from "@/lib/hooks";

type Item = { title: string; body: string; image: string };

/**
 * The approach as numbered rows. Hovering a row brightens it, nudges its title across and brings up that
 * step's picture beside the pointer; the picture trails the pointer and swaps as you move between rows.
 *
 * The picture is decoration (the rows carry the meaning), so it is hidden from assistive technology. It shows
 * only for a mouse or trackpad, and without the trailing motion for visitors who ask for reduced motion.
 */
export function ApproachList({ items }: { items: readonly Item[] }) {
  const finePointer = useFinePointer();
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const [armed, setArmed] = useState(false);
  const floatRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const pos = useRef({ x: 0, y: 0 });
  const raf = useRef(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const place = () => {
    const el = floatRef.current;
    if (el) el.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) translate(-50%, -50%)`;
  };

  const tick = () => {
    const k = 0.18;
    pos.current.x += (target.current.x - pos.current.x) * k;
    pos.current.y += (target.current.y - pos.current.y) * k;
    place();
    const settled = Math.abs(target.current.x - pos.current.x) < 0.5 && Math.abs(target.current.y - pos.current.y) < 0.5;
    raf.current = settled ? 0 : requestAnimationFrame(tick);
  };

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    target.current = { x: e.clientX + 170, y: e.clientY };
    if (reduced || active === null) {
      // jump straight to the pointer when appearing, or always when motion is reduced
      pos.current = { ...target.current };
      place();
      if (reduced) return;
    }
    if (!raf.current) raf.current = requestAnimationFrame(tick);
  };

  const show = finePointer && active !== null;

  return (
    <div onPointerMove={onMove} onPointerLeave={() => setActive(null)}>
      <ol className="text-[length:var(--text-ui)] leading-[1.7]">
        {items.map((it, i) => {
          const on = active === i;
          return (
            <li
              key={it.title}
              onPointerEnter={(e) => {
                if (e.pointerType !== "mouse") return;
                setArmed(true);
                setActive(i);
              }}
              className="group grid grid-cols-[2.5rem_1fr] gap-x-5 gap-y-1.5 border-t border-line py-7 first:border-t-0 first:pt-0 sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,2fr)]"
            >
              <span aria-hidden className={`tabular-nums transition-colors duration-300 ${on ? "text-bone" : "text-mute"}`}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={`text-bone transition-transform duration-500 ease-[var(--ease-out-expo)] motion-reduce:transition-none ${on ? "translate-x-2" : ""}`}
              >
                {it.title}
              </span>
              <span className={`col-start-2 transition-colors duration-300 sm:col-start-auto ${on ? "text-bone" : "text-soft"}`}>{it.body}</span>
            </li>
          );
        })}
      </ol>

      {finePointer && armed && (
        <div
          ref={floatRef}
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 z-30 will-change-transform"
          style={{ transform: `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) translate(-50%, -50%)` }}
        >
          <div
            className={`relative aspect-[4/3] w-[280px] overflow-hidden rounded-card bg-ink-3 transition-[opacity,scale] duration-300 ease-out motion-reduce:transition-none ${
              show ? "scale-100 opacity-100" : "scale-90 opacity-0"
            }`}
          >
            {items.map((it, i) => (
              <Image
                key={it.image}
                src={it.image}
                alt=""
                fill
                sizes="280px"
                unoptimized
                className={`object-cover transition-opacity duration-300 ${active === i ? "opacity-100" : "opacity-0"}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

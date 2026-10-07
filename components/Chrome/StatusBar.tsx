"use client";

import { useEffect, useState } from "react";
import { site } from "@/lib/content";

/**
 * Fixed footer rail: year, timezone, a live local clock and availability.
 * Mono, uppercase and deliberately quiet — the instrument panel under the page.
 *
 * The rail is fixed, so it passes over both dark and cream sections and cannot
 * know its own backdrop. `mix-blend-difference` against pure white resolves to
 * near-black on cream and near-white on ink, in either theme — no observer and
 * no per-section bookkeeping.
 *
 * The clock renders empty on the server and fills in after mount, so the
 * markup matches on hydration regardless of the visitor's timezone.
 *
 * The rail stands down once the footer appears: the footer carries its own
 * copyright line in the same place, so leaving the rail up would both overlap
 * it and say the year twice.
 */
export function StatusBar() {
  const [now, setNow] = useState<string>("");
  const [zone, setZone] = useState<string>("");
  const [atFooter, setAtFooter] = useState(false);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(
        d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
      );
    };
    tick();
    const id = setInterval(tick, 1000);

    const offset = -new Date().getTimezoneOffset() / 60;
    const sign = offset >= 0 ? "+" : "−";
    setZone(`UTC${sign}${Math.abs(offset)}`);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const obs = new IntersectionObserver(([entry]) => setAtFooter(entry.isIntersecting), {
      threshold: 0,
    });
    obs.observe(footer);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 hidden gutter pb-4 transition-opacity duration-500 md:block ${
        atFooter ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="mx-auto grid max-w-[1600px] grid-cols-12 items-center gap-8 font-mono text-micro uppercase tracking-[0.14em] text-white mix-blend-difference">
        <span className="col-span-3">© {new Date().getFullYear()}</span>
        <span className="col-start-4 col-span-3 tabular-nums">{zone}</span>
        <span className="col-start-8 col-span-2 tabular-nums">{now}</span>
        <span className="col-start-10 col-span-3 flex items-center justify-end gap-2 whitespace-nowrap">
          {site.available && <span className="size-1 bg-current" />}
          {site.available ? site.availabilityLabel : "Studio"}
        </span>
      </div>
    </div>
  );
}

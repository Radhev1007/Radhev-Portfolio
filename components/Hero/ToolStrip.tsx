"use client";

import { useRef, useState } from "react";
import { tools } from "@/lib/content";
import { iconPaths } from "./toolMarks";

type Tip = { name: string; x: number; y: number } | null;

/** The dock-style swell: the logo under the pointer grows to PEAK, its neighbours less, out to REACH px away. */
const PEAK = 1.55;
const REACH = 220;

/**
 * The tools I work in, as real, full-colour logos on wide quiet tiles drifting left, as the reference sets its
 * client logos. Hovering or focusing one names it in a tooltip. The tooltip is one floating element placed from
 * the tile's position, because anything inside the scrolling strip would be clipped by it. The strip pauses
 * while a tile is hovered or focused; the second copy that makes the loop seamless is hidden from assistive
 * technology and from the tab order.
 *
 * Hover works like the macOS dock: the logo nearest the pointer swells and lifts, and the logos either side of it
 * swell less the further they are, so the magnification rolls along the strip as the pointer moves. Only the
 * logos grow; the tiles keep their size. Skipped for visitors who ask for reduced motion.
 */
export function ToolStrip() {
  const [tip, setTip] = useState<Tip>(null);
  const show = (name: string) => (e: React.SyntheticEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ name, x: r.left + r.width / 2, y: r.top });
  };
  const hide = () => setTip(null);

  const stripRef = useRef<HTMLDivElement>(null);
  const magnify = (x: number | null) => {
    const strip = stripRef.current;
    if (!strip || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    strip.querySelectorAll<HTMLElement>("[data-mag]").forEach((el) => {
      let scale = 1;
      if (x !== null) {
        const r = el.getBoundingClientRect();
        const reach = Math.abs(x - (r.left + r.width / 2)) / REACH;
        if (reach < 1) scale = 1 + (PEAK - 1) * Math.cos((reach * Math.PI) / 2) ** 2;
      }
      el.style.transform = scale === 1 ? "" : `translateY(${(-(scale - 1) * 10).toFixed(1)}px) scale(${scale.toFixed(3)})`;
    });
  };

  return (
    <div
      ref={stripRef}
      className="group/strip relative"
      onPointerMove={(e) => e.pointerType === "mouse" && magnify(e.clientX)}
      onPointerLeave={() => magnify(null)}
    >
      <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_6%,#000_94%,transparent)]">
        <div className="flex w-max animate-[marquee_40s_linear_infinite] group-focus-within/strip:[animation-play-state:paused] group-hover/strip:[animation-play-state:paused]">
          {[0, 1].map((copy) => (
            <ul
              key={copy}
              aria-label={copy === 0 ? "Tools" : undefined}
              aria-hidden={copy === 1 || undefined}
              className="flex shrink-0 gap-2.5 pr-2.5"
            >
              {tools.map((t) => (
                <li key={t.name}>
                  <span
                    tabIndex={copy === 0 ? 0 : -1}
                    role="img"
                    aria-label={t.name}
                    onPointerEnter={show(t.name)}
                    onPointerLeave={hide}
                    onFocus={show(t.name)}
                    onBlur={hide}
                    className="grid h-[66px] w-[99px] place-items-center rounded-[4px] bg-ink-3 transition-colors duration-300 hover:bg-line-strong focus-visible:bg-line-strong"
                  >
                    <span data-mag className="inline-flex transition-transform duration-200 ease-out will-change-transform">
                      <Mark mark={t.mark} />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>

      {tip && (
        <span
          aria-hidden
          style={{ position: "fixed", left: tip.x, top: tip.y - 8, transform: "translate(-50%, -100%)" }}
          className="pointer-events-none z-[60] whitespace-nowrap rounded-[4px] border border-line-strong bg-ink-3 px-2.5 py-1.5 text-[length:var(--text-ui)] leading-none text-bone"
        >
          {tip.name}
        </span>
      )}
    </div>
  );
}

/** Each tool in its own real colours. */
function Mark({ mark }: { mark: string }) {
  if (mark === "photoshop") {
    // the set's path is the navy tile with "Ps" cut out; the cyan behind it shows through the cut-out
    return (
      <svg viewBox="0 0 128 128" className="size-8" aria-hidden>
        <rect x="0" y="1.6" width="128" height="124.8" rx="23" fill="#31A8FF" />
        <path d={iconPaths.photoshop.d} fill="#001E36" />
      </svg>
    );
  }
  if (mark === "chatgpt") {
    // the app icon: the OpenAI knot, white, on ChatGPT's green
    return (
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="7" fill="#10A37F" />
        <svg x="6" y="6" width="20" height="20" viewBox="0 0 24 24">
          <path d={iconPaths.chatgpt.d} fill="#FFFFFF" />
        </svg>
      </svg>
    );
  }
  if (mark === "jitter") {
    // Jitter's own app icon, as it publishes it (a PNG)
    return <img src="/tools/jitter.png" alt="" width={32} height={32} className="size-8 rounded-[7px]" />;
  }
  if (mark === "figma") {
    return (
      <svg viewBox="0 0 38 57" className="h-8 w-auto" aria-hidden>
        <path d="M19 0H9.5a9.5 9.5 0 0 0 0 19H19z" fill="#F24E1E" />
        <path d="M19 0h9.5a9.5 9.5 0 0 1 0 19H19z" fill="#FF7262" />
        <path d="M19 19H9.5a9.5 9.5 0 0 0 0 19H19z" fill="#A259FF" />
        <circle cx="28.5" cy="28.5" r="9.5" fill="#1ABCFE" />
        <path d="M9.5 38H19v9.5A9.5 9.5 0 1 1 9.5 38z" fill="#0ACF83" />
      </svg>
    );
  }
  const { d, color, viewBox } = iconPaths[mark];
  return (
    <svg viewBox={viewBox ?? "0 0 24 24"} className="size-8" aria-hidden>
      <path d={d} fill={color} />
    </svg>
  );
}

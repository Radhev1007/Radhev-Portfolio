"use client";

import { AnimatePresence, motion, type TargetAndTransition } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ScrambleText } from "@/components/Animations/ScrambleText";
import { useLenis } from "@/components/Providers/SmoothScroll";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { ease, INTRO_HOLD } from "@/lib/motion";

/**
 * The opening screen, once per page load: on black, the logo builds itself —
 * the r's stem rises, its shoulder sweeps out, the accent foot drops into
 * place — while the wordmark decodes beside it (the same scramble as the nav)
 * and a counter runs to 100. Then the screen lifts away upward and the hero's
 * own entrance (timed after INTRO_HOLD, lib/motion) plays as it is revealed.
 *
 * The page is rendered underneath the whole time, so search engines and the
 * page-speed metrics see the content at once; only scrolling waits. Reduced
 * motion gets the finished logo and a short fade.
 */
const STEM = 0.55, SHOULDER = 0.5, FOOT = 0.45;

export function IntroLoader() {
  const reduced = usePrefersReducedMotion();
  const lenis = useLenis();
  const [open, setOpen] = useState(true);
  const count = useRef<HTMLSpanElement>(null);

  // hold scrolling while the screen is up
  useEffect(() => {
    if (!open) return;
    lenis?.stop();
    const html = document.documentElement, prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { lenis?.start(); html.style.overflow = prev; };
  }, [open, lenis]);

  // the counter, then lift the screen
  useEffect(() => {
    const total = (reduced ? 0.6 : INTRO_HOLD) * 1000, t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / total);
      const eased = 1 - (1 - k) ** 3;
      if (count.current) count.current.textContent = String(Math.round(eased * 100)).padStart(3, "0");
      if (k < 1) raf = requestAnimationFrame(tick);
      else setOpen(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const from = (v: TargetAndTransition): TargetAndTransition => (reduced ? {} : v);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="intro"
          aria-hidden
          className="fixed inset-0 z-[250] flex flex-col bg-ink text-bone"
          exit={reduced ? { opacity: 0 } : { clipPath: "inset(0% 0% 100% 0%)" }}
          initial={{ clipPath: "inset(0% 0% 0% 0%)" }}
          transition={{ duration: reduced ? 0.4 : 0.9, ease: ease.inOutQuart }}
        >
          <motion.div
            className="flex flex-1 items-center justify-center gap-5"
            exit={from({ y: -40, opacity: 0 })}
            transition={{ duration: 0.6, ease: ease.inOutQuart }}
          >
            <svg viewBox="26 24 50 56" className="h-14 w-auto md:h-16" fill="none">
              <defs>
                <clipPath id="intro-shoulder">
                  <motion.rect
                    x="36" y="24" height="28"
                    initial={from({ width: 0 })}
                    animate={{ width: 40 }}
                    transition={{ delay: STEM * 0.7, duration: SHOULDER, ease: ease.outExpo }}
                  />
                </clipPath>
              </defs>
              {/* stem rises from its foot */}
              <motion.rect
                x="26" y="24" width="17" height="56" fill="currentColor"
                style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
                initial={from({ scaleY: 0 })}
                animate={{ scaleY: 1 }}
                transition={{ duration: STEM, ease: ease.outExpo }}
              />
              {/* shoulder sweeps out from the stem */}
              <path d="M36 24h12a28 28 0 0 1 28 28H59a11 11 0 0 0-11-11H36z" fill="currentColor" clipPath="url(#intro-shoulder)" />
              {/* the accent foot drops into place */}
              <motion.rect
                x="26" y="68" width="17" height="12" fill="var(--color-accent)"
                initial={from({ y: -26, opacity: 0 })}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: STEM * 0.7 + SHOULDER * 0.6, type: "spring", stiffness: 420, damping: 22 }}
              />
            </svg>
            <motion.span
              className="text-lead font-medium uppercase tracking-[0.3em]"
              initial={from({ opacity: 0, x: -8 })}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: STEM * 0.5, duration: 0.6, ease: ease.outExpo }}
            >
              <ScrambleText text="Radhev" onMount={!reduced} stagger={2.4} />
            </motion.span>
          </motion.div>
          <div className="flex items-end justify-between gutter pb-6 font-mono text-[0.75rem] uppercase tracking-[0.14em] text-mute">
            <span>UI/UX &amp; Product Designer</span>
            <span ref={count} className="text-[3rem] leading-none tracking-[-0.04em] text-bone tabular-nums md:text-[4rem]">000</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { ease } from "@/lib/motion";

type Props = { lines: string[]; delay?: number; /** A word to set in the accent colour. */ accent?: string };

/**
 * The positioning statement, one masked line at a time.
 *
 * It sets at the display step rather than the hero step: the hero step is
 * bound to viewport height and only ever fitted a word or two, which is why
 * it carried a job title. A statement needs the width, so the lines are
 * `whitespace-nowrap` and the size is chosen to let the longest one sit on
 * one line at every breakpoint.
 *
 * Every line is set light and white; one word carries the accent colour.
 */
export function HeroIdentity({ lines, delay = 0, accent }: Props) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLHeadingElement>(null);
  let n = 0;

  /*
   * Hovering a word decodes it, as the nav does (ScrambleText): its letters cycle through random characters
   * and settle left to right. Each letter's width is held while it plays, so the line never jitters; the
   * heading's text and accessible name are untouched. Not for reduced motion or touch.
   */
  useEffect(() => {
    const h1 = ref.current;
    if (!h1 || reduced) return;
    const NOISE_U = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", NOISE_L = "abcdefghijklmnopqrstuvwxyz", MARKS = "0123456789#%&*+=/<>?!";
    const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
    const noise = (c: string) => (Math.random() < 0.3 ? pick(MARKS) : c !== c.toLowerCase() ? pick(NOISE_U) : pick(NOISE_L));
    const running = new WeakSet<HTMLElement>();
    const cleanups: (() => void)[] = [];
    for (const word of h1.querySelectorAll<HTMLElement>("[data-word]")) {
      const play = (e: PointerEvent) => {
        if (e.pointerType === "touch" || running.has(word)) return;
        running.add(word);
        const chars = [...word.querySelectorAll<HTMLElement>("[data-ch]")];
        const real = chars.map((c) => c.textContent ?? "");
        chars.forEach((c) => { c.style.width = `${c.getBoundingClientRect().width}px`; c.style.textAlign = "center"; });
        let step = 0;
        const timer = window.setInterval(() => {
          step++;
          chars.forEach((c, i) => { c.textContent = step >= 4 + i * 1.6 ? real[i] : noise(real[i]); });
          if (step >= real.length * 1.6 + 6) {
            clearInterval(timer);
            chars.forEach((c, i) => { c.textContent = real[i]; c.style.width = ""; c.style.textAlign = ""; });
            running.delete(word);
          }
        }, 32);
        cleanups.push(() => clearInterval(timer));
      };
      word.addEventListener("pointerenter", play);
      cleanups.push(() => word.removeEventListener("pointerenter", play));
    }
    return () => cleanups.forEach((f) => f());
  }, [reduced]);

  return (
    <h1
      ref={ref}
      aria-label={lines.join(" ")}
      className="text-hero leading-[0.98] md:leading-[0.94]"
    >
      {lines.map((text, li) => {
        const last = li === lines.length - 1;
        // (the space after each line, see below, keeps the words apart in the page text that crawlers read:
        // block lines alone run together as "complexdigital")
        const at = accent ? text.indexOf(accent) : -1;
        return [
          <span
            key={text}
            aria-hidden
            className={`-mb-[0.04em] block overflow-hidden whitespace-nowrap pb-[0.1em] ${
              last ? "font-accent" : "font-light tracking-[-0.035em]"
            }`}
          >
            {text.split(/( )/).map((tok, ti, toks) => {
              const start = toks.slice(0, ti).join("").length;
              const chars = tok.split("").map((c, k) => {
                const ci = start + k, i = n++;
                const lit = at >= 0 && ci >= at && ci < at + (accent?.length ?? 0);
                return (
                  <motion.span
                    key={i}
                    data-ch
                    className={`inline-block will-change-transform ${lit ? "text-accent" : ""}`}
                    initial={{ y: reduced ? 0 : "105%", opacity: reduced ? 0 : 1 }}
                    animate={{ y: "0%", opacity: 1 }}
                    transition={{ duration: 1.1, ease: ease.outExpo, delay: delay + i * 0.016 }}
                  >
                    {c === " " ? "\u00a0" : c}
                  </motion.span>
                );
              });
              // each word is one hover target (the decode above); spaces stay loose
              return tok === " " ? chars : <span key={`w${ti}`} data-word className="inline-block">{chars}</span>;
            })}
          </span>,
          ...(last ? [] : [" "]),
        ];
      })}
    </h1>
  );
}

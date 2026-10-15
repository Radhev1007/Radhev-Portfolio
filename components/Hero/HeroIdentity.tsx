"use client";

import { motion } from "framer-motion";
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
  let n = 0;

  return (
    <h1
      aria-label={lines.join(" ")}
      className="text-headline leading-[0.98] md:leading-[0.94]"
    >
      {lines.map((text, li) => {
        const last = li === lines.length - 1;
        const at = accent ? text.indexOf(accent) : -1;
        return (
          <span
            key={text}
            aria-hidden
            className={`-mb-[0.04em] block overflow-hidden whitespace-nowrap pb-[0.1em] ${
              last ? "font-accent" : "font-light tracking-[-0.035em]"
            }`}
          >
            {text.split("").map((c, ci) => {
              const i = n++;
              const lit = at >= 0 && ci >= at && ci < at + (accent?.length ?? 0);
              return (
                <motion.span
                  key={i}
                  className={`inline-block will-change-transform ${lit ? "text-accent" : ""}`}
                  initial={{ y: reduced ? 0 : "105%", opacity: reduced ? 0 : 1 }}
                  animate={{ y: "0%", opacity: 1 }}
                  transition={{ duration: 1.1, ease: ease.outExpo, delay: delay + i * 0.016 }}
                >
                  {c === " " ? " " : c}
                </motion.span>
              );
            })}
          </span>
        );
      })}
    </h1>
  );
}

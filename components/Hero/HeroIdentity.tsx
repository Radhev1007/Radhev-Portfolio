"use client";

import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { ease } from "@/lib/motion";

type Props = { lines: string[]; delay?: number };

/**
 * The positioning statement, one masked line at a time.
 *
 * It sets at the display step rather than the hero step: the hero step is
 * bound to viewport height and only ever fitted a word or two, which is why
 * it carried a job title. A statement needs the width, so the lines are
 * `whitespace-nowrap` and the size is chosen to let the longest one sit on
 * one line at every breakpoint.
 *
 * The last line takes the lighter voice, so the sentence resolves rather than
 * ending at full weight.
 */
export function HeroIdentity({ lines, delay = 0 }: Props) {
  const reduced = usePrefersReducedMotion();
  let n = 0;

  return (
    <h1
      aria-label={lines.join(" ")}
      className="text-headline leading-[0.98] md:leading-[0.94]"
    >
      {lines.map((text, li) => {
        const last = li === lines.length - 1;
        return (
          <span
            key={text}
            aria-hidden
            className={`-mb-[0.04em] block overflow-hidden whitespace-nowrap pb-[0.1em] ${
              last ? "font-accent text-bone/70" : "font-medium tracking-[-0.045em]"
            }`}
          >
            {text.split("").map((c) => {
              const i = n++;
              return (
                <motion.span
                  key={i}
                  className="inline-block will-change-transform"
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

"use client";

import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { ease } from "@/lib/motion";

type Props = { first: string; last: string; delay?: number };

/**
 * The display line in two weights of the same family: `first` in Medium,
 * `last` in Light. Each line rises from a mask, letter by letter.
 */
export function HeroIdentity({ first, last, delay = 0 }: Props) {
  const reduced = usePrefersReducedMotion();
  const lines = [
    { text: first, accent: false },
    { text: last, accent: true },
  ];
  let n = 0;

  return (
    <h1
      aria-label={`${first} ${last}`}
      className="mt-8 text-[min(19vw,15svh)] leading-[0.9] md:mt-10 md:text-[min(8.6vw,17svh,10.5rem)]"
    >
      {lines.map((line) => (
        <span
          key={line.text}
          aria-hidden
          className={`-mb-[0.06em] block overflow-hidden whitespace-nowrap pb-[0.14em] ${
            line.accent ? "font-accent text-bone/85" : "font-medium tracking-[-0.055em]"
          }`}
        >
          {line.text.split("").map((c) => {
            const i = n++;
            return (
              <motion.span
                key={i}
                className="inline-block will-change-transform"
                initial={{ y: reduced ? 0 : "105%", opacity: reduced ? 0 : 1 }}
                animate={{ y: "0%", opacity: 1 }}
                transition={{ duration: 1.2, ease: ease.outExpo, delay: delay + i * 0.035 }}
              >
                {c === " " ? " " : c}
              </motion.span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}

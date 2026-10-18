"use client";

import { motion } from "framer-motion";

import { ease, viewportOnce } from "@/lib/motion";

type Props = {
  text: string;
  as?: "p" | "h1" | "h2" | "h3" | "span" | "div";
  className?: string;
  /** Delay before the first word (s). */
  delay?: number;
  /** Stagger between words (s). */
  stagger?: number;
  /** Animate on mount instead of when scrolled into view. */
  immediate?: boolean;
};

/**
 * Masked word-by-word reveal.
 *
 * The animated words are the only copy of the text. It used to carry a second,
 * visually-hidden copy for screen readers beside an aria-hidden animated one,
 * and everything that reads the page as text — search snippets, link previews,
 * reader modes, copy and paste — got both ("Selected Selected Work Work").
 * Each word keeps its trailing space, so the text reads as one sentence.
 */
export function TextReveal({ text, as: Tag = "p", className, delay = 0, stagger = 0.06, immediate }: Props) {
  const words = text.split(" ");
  const trigger = immediate ? { animate: "show" } : { whileInView: "show", viewport: viewportOnce };

  return (
    <Tag className={className}>
      <motion.span
        className="inline"
        initial="hidden"
        {...trigger}
        transition={{ staggerChildren: stagger, delayChildren: delay }}
      >
        {words.map((word, i) => (
          <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom leading-[inherit]">
            <motion.span
              className="inline-block will-change-transform"
              variants={{
                hidden: { y: "105%", rotate: 4 },
                show: { y: "0%", rotate: 0, transition: { duration: 1.1, ease: ease.outExpo } },
              }}
            >
              {word}
              {i < words.length - 1 ? " " : ""}
            </motion.span>
          </span>
        ))}
      </motion.span>
    </Tag>
  );
}

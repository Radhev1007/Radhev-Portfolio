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
 * Masked word-by-word reveal. The full string is kept as visually-hidden
 * text so screen readers read one sentence, not fragments (aria-label is
 * ignored on generic elements like <span>).
 */
export function TextReveal({ text, as: Tag = "p", className, delay = 0, stagger = 0.06, immediate }: Props) {
  const words = text.split(" ");
  const trigger = immediate ? { animate: "show" } : { whileInView: "show", viewport: viewportOnce };

  return (
    <Tag className={className}>
      <span className="sr-only">{text} </span>
      <motion.span
        aria-hidden
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

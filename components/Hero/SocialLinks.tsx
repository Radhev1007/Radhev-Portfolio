"use client";

import { motion } from "framer-motion";
import { site } from "@/lib/content";
import { intro, transition } from "@/lib/motion";

/** Understated profile links along the bottom-left of the hero. */
export function SocialLinks() {
  return (
    <motion.ul
      aria-label="Profiles"
      className="absolute bottom-8 left-[var(--gutter)] z-10 hidden items-center gap-6 md:flex"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transition(intro.nav, 1.2)}
    >
      {site.socials.map((s) => (
        <li key={s.label}>
          <a
            href={s.href}
            target="_blank"
            rel="noreferrer"
            className="group label inline-flex items-center gap-1.5 !text-mute transition-colors duration-300 hover:!text-bone"
          >
            {s.label}
            <span aria-hidden className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent">
              ↗
            </span>
          </a>
        </li>
      ))}
    </motion.ul>
  );
}

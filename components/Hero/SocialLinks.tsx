"use client";

import { motion } from "framer-motion";
import { site } from "@/lib/content";
import { intro, transition } from "@/lib/motion";

/** Understated profile links; the hero places them under its call to action. */
export function SocialLinks() {
  return (
    <motion.ul
      aria-label="Profiles"
      className="z-10 mt-6 flex flex-wrap items-center gap-x-6 gap-y-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transition(intro.nav, 1.2)}
    >
      {[...site.socials, { label: "Résumé", href: site.resume }].map((s) => (
        <li key={s.label}>
          <a
            href={s.href}
            target="_blank"
            rel="noreferrer"
            className="group label inline-flex items-center gap-2 !text-mute transition-colors duration-300 hover:!text-bone"
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

"use client";

import { motion } from "framer-motion";
import { site } from "@/lib/content";
import { intro, transition } from "@/lib/motion";
import { SocialGlyph, type SocialIcon } from "./SocialIcons";

/** Profiles that carry an icon. LinkedIn is the hero's second button, so it has none. */
const profiles = site.socials.flatMap((s) => ("icon" in s ? [{ ...s, icon: s.icon as SocialIcon }] : []));

function IconLink({ label, href, icon }: { label: string; href: string; icon: SocialIcon }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      data-cursor="hover"
      className="grid size-10 place-items-center border border-line text-bone/70 transition-colors duration-300 hover:border-accent hover:bg-accent hover:text-white"
    >
      <SocialGlyph name={icon} className="size-[18px]" />
    </a>
  );
}

/**
 * Profile links as icons.
 *
 * From tablet up they stand in a vertical rail on the hero's right edge,
 * between two hairlines, where the layout otherwise leaves the margin empty.
 * On phones there is no margin to spare, so the same icons sit in a row
 * under the call to action.
 */
const appear = { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: transition(intro.nav, 1.2) };

/** Phones: a row under the call to action. */
export function SocialLinks() {
  return (
      <motion.ul aria-label="Profiles" className="z-10 mt-8 flex items-center gap-3 md:hidden" {...appear}>
        {profiles.map((p) => (
          <li key={p.label}>
            <IconLink {...p} />
          </li>
        ))}
      </motion.ul>
  );
}

/** Tablet up: a vertical rail. Render it as a direct child of the hero section. */
export function SocialRail() {
  return (
      <motion.div
        className="pointer-events-none absolute inset-y-0 right-[max(0.75rem,calc(var(--gutter)/2-1.25rem))] z-10 hidden flex-col items-center justify-center gap-4 md:flex"
        {...appear}
      >
        <span aria-hidden className="h-16 w-px bg-line" />
        <span className="label [writing-mode:vertical-rl] rotate-180">Follow</span>
        <ul aria-label="Profiles" className="pointer-events-auto flex flex-col gap-2">
          {profiles.map((p) => (
            <li key={p.label}>
              <IconLink {...p} />
            </li>
          ))}
        </ul>
        <span aria-hidden className="h-16 w-px bg-line" />
      </motion.div>
  );
}

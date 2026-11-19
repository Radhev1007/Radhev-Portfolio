import Magnet from "@/components/Magnet/Magnet";
import { site } from "@/lib/content";
import { SocialGlyph, type SocialIcon } from "./SocialIcons";

/** The profiles that carry an icon, in the order the content lists them. */
const profiles = site.socials.flatMap((s) =>
  "icon" in s ? [{ ...s, icon: s.icon as SocialIcon }] : [],
);

/**
 * Profile links as round hairline buttons that fill white on hover, set at the top of the hero's left rail:
 * stacked in a column from desktop up, in a row on phones so the headline stays on the first screen. Each one
 * leans toward a nearby pointer (React Bits' Magnet).
 */
export function SocialLinks() {
  return (
    <ul aria-label="Profiles" className="flex items-center gap-2.5 lg:flex-col lg:items-start">
      {profiles.map((p) => (
        <li key={p.label}>
          <Magnet padding={40} magnetStrength={3}>
            <a
              href={p.href}
              target="_blank"
              rel="noreferrer"
              aria-label={`${p.label} (opens in a new tab)`}
              title={p.label}
              className="grid size-10 place-items-center rounded-full border border-line-strong text-soft transition-[background-color,color,transform] duration-300 hover:-translate-y-0.5 hover:border-bone hover:bg-bone hover:text-ink focus-visible:border-bone focus-visible:bg-bone focus-visible:text-ink"
            >
              <SocialGlyph name={p.icon} className="size-[17px]" />
            </a>
          </Magnet>
        </li>
      ))}
    </ul>
  );
}

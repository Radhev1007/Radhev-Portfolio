import { site } from "@/lib/content";
import { SocialGlyph, type SocialIcon } from "./SocialIcons";

/** The profiles that carry an icon, in the order the content lists them. */
const profiles = site.socials.flatMap((s) => ("icon" in s ? [{ ...s, icon: s.icon as SocialIcon }] : []));

/**
 * Profile links as round hairline buttons that fill white on hover, set in the hero's left rail, just under
 * the location line. A different shape from the boxed icons of the earlier rail: circles, in a row.
 */
export function SocialLinks() {
  return (
    <ul aria-label="Profiles" className="flex items-center gap-2.5">
      {profiles.map((p) => (
        <li key={p.label}>
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
        </li>
      ))}
    </ul>
  );
}

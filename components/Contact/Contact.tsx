import { Reveal } from "@/components/Animations/Reveal";
import { Ext, Section } from "@/components/Section/Section";
import { site } from "@/lib/content";

const linkClass =
  "text-bone underline decoration-transparent underline-offset-4 transition-colors duration-300 hover:decoration-bone focus-visible:decoration-bone";

/** Connect: the closing statement, then the ways to reach me. */
export function Contact() {
  const links = site.socials.filter((s) => s.label === "LinkedIn" || s.label === "Behance" || s.label === "Dribbble");
  return (
    <Section id="contact" title="Connect">
      <Reveal>
        <p className="max-w-[22ch] text-[length:var(--text-h1)] leading-[1.1] tracking-[-0.033em] text-bone">
          Let&rsquo;s design something clear together.
        </p>
      </Reveal>
      <Reveal delay={0.1}>
        <ul className="mt-8 text-[length:var(--text-ui)] leading-[1.7]">
          <li>
            <a href={`mailto:${site.email}`} className={linkClass}>
              Email me
            </a>
            <span className="ml-3 text-mute">{site.email}</span>
          </li>
          {links.map((s) => (
            <li key={s.label}>
              <a href={s.href} target="_blank" rel="noreferrer" className={linkClass}>
                {s.label}
              </a>
              <Ext />
            </li>
          ))}
          <li>
            <a href={site.resume} target="_blank" rel="noreferrer" className={linkClass}>
              Résumé
            </a>
            <Ext />
          </li>
        </ul>
      </Reveal>
    </Section>
  );
}

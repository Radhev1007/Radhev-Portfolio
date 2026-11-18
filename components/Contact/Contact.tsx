import { Reveal } from "@/components/Animations/Reveal";
import { Headline, Lead } from "@/components/Section/Parts";
import { Ext, Section } from "@/components/Section/Section";
import { contactSection, site } from "@/lib/content";
import { LaserCard } from "./LaserCard";

/** Connect: the closing statement, then the ways to reach me on a card lit by a falling beam (LaserCard). */
export function Contact() {
  const social = (label: string) => site.socials.find((s) => s.label === label)!.href;
  const links = [
    { label: "Connect on LinkedIn", href: social("LinkedIn") },
    { label: "View My Behance", href: social("Behance") },
    { label: "Download Resume", href: site.resume },
  ];
  return (
    <Section id="contact" title={contactSection.label}>
      <Reveal>
        <Headline>{contactSection.headline}</Headline>
        <div className="mt-5 flex max-w-[56ch] flex-col gap-4">
          {contactSection.description.map((p) => (
            <Lead key={p}>{p}</Lead>
          ))}
        </div>
      </Reveal>
      <LaserCard>
        {/* the email first, large, as the main way in; then where I am; then the other routes as ruled rows */}
        <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <p className="label">Email</p>
            <a
              href={`mailto:${site.email}`}
              className="mt-2 inline-block break-all text-[clamp(1.375rem,2.6vw,2.25rem)] leading-[1.15] tracking-[-0.03em] text-bone underline decoration-line-strong decoration-1 underline-offset-[0.2em] transition-colors duration-300 hover:decoration-bone focus-visible:decoration-bone"
            >
              {site.email}
            </a>
          </div>
          <div className="text-[length:var(--text-ui)] leading-[1.7] sm:text-right">
            <p className="label">Based in</p>
            <p className="mt-1 text-bone">{site.location}</p>
          </div>
        </div>
        <ul className="mt-12 grid grid-cols-1 gap-x-5 text-[length:var(--text-ui)] leading-[1.7] sm:grid-cols-2">
          {[{ label: "Get in Touch", href: `mailto:${site.email}`, external: false }, ...links.map((l) => ({ ...l, external: true }))].map(
            (l) => (
              <li key={l.label} className="border-t border-line">
                <a
                  href={l.href}
                  {...(l.external ? { target: "_blank", rel: "noreferrer" } : {})}
                  className="group flex items-center justify-between gap-4 py-4 text-soft transition-colors duration-300 hover:text-bone focus-visible:text-bone"
                >
                  <span>
                    {l.label}
                    {l.external && <Ext />}
                  </span>
                  <span
                    aria-hidden
                    className="text-mute transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-bone"
                  >
                    ↗
                  </span>
                </a>
              </li>
            ),
          )}
        </ul>
      </LaserCard>
    </Section>
  );
}

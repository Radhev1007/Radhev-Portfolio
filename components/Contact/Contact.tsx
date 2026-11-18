import { Reveal } from "@/components/Animations/Reveal";
import { Headline, Lead, linkClass } from "@/components/Section/Parts";
import { Ext, Section } from "@/components/Section/Section";
import { contactSection, site } from "@/lib/content";

/** Connect: the closing statement, the ways to reach me and my availability. */
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
      <Reveal delay={0.1}>
        <dl className="mt-12 text-[length:var(--text-ui)] leading-[1.7]">
          <div className="flex gap-x-5">
            <dt className="w-20 text-mute">Email</dt>
            <dd>
              <a href={`mailto:${site.email}`} className={linkClass}>
                {site.email}
              </a>
            </dd>
          </div>
          <div className="flex gap-x-5">
            <dt className="w-20 text-mute">Location</dt>
            <dd className="text-bone">{site.location}</dd>
          </div>
        </dl>
        <ul className="mt-8 flex flex-col gap-1 text-[length:var(--text-ui)] leading-[1.7]">
          <li>
            <a href={`mailto:${site.email}`} className={linkClass}>
              Get in Touch
            </a>
          </li>
          {links.map((l) => (
            <li key={l.label}>
              <a href={l.href} target="_blank" rel="noreferrer" className={linkClass}>
                {l.label}
              </a>
              <Ext />
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  );
}

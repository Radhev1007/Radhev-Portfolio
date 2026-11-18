import { Reveal } from "@/components/Animations/Reveal";
import { Section } from "@/components/Section/Section";
import { openTo, site } from "@/lib/content";

const numerals = ["¹", "²", "³", "⁴", "⁵"];

/** The availability statement, set at the headline size, with who I would like to hear from. */
export function OpenTo() {
  return (
    <Section id="open" title="Open to conversations with">
      <Reveal>
        <p className="max-w-[26ch] text-[length:var(--text-h1)] leading-[1.1] tracking-[-0.033em] text-bone">{openTo.statement}</p>
      </Reveal>
      <Reveal delay={0.1}>
        <p className="mt-8 text-[length:var(--text-ui)] leading-[1.7] text-mute">{openTo.lead}</p>
        <ul className="mt-1 text-[length:var(--text-ui)] leading-[1.7] text-soft">
          {openTo.list.map((item, i) => (
            <li key={item}>
              <span aria-hidden className="mr-2 text-mute">
                {numerals[i]}
              </span>
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-[length:var(--text-ui)] leading-[1.7]">
          <a
            href={`mailto:${site.email}`}
            className="text-bone underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:decoration-bone"
          >
            {openTo.cta}
          </a>
        </p>
      </Reveal>
    </Section>
  );
}

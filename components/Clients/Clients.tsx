import { Reveal } from "@/components/Animations/Reveal";
import { Section } from "@/components/Section/Section";
import { clients } from "@/lib/content";

/** Previously worked with: names only, since no client has agreed to a logo. */
export function Clients() {
  return (
    <Section id="clients" title="Previously worked with">
      <Reveal>
        <ul className="flex max-w-[640px] flex-wrap text-[length:var(--text-ui)] leading-[1.7] text-soft">
          {clients.map((c, i) => (
            <li key={c} className="whitespace-pre">
              {c}
              {i < clients.length - 1 ? ", " : ""}
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  );
}

import type { ReactNode } from "react";
import { Reveal } from "@/components/Animations/Reveal";
import { Section } from "@/components/Section/Section";
import type { Numbered, SectionCopy } from "@/lib/content";

/** The headline every homepage section opens with, at the same size as the hero's. */
export function Headline({ children }: { children: ReactNode }) {
  return <h3 className="max-w-[26ch] text-[length:var(--text-h1)] leading-[1.1] tracking-[-0.033em] text-bone">{children}</h3>;
}

/** A grey supporting paragraph. */
export function Lead({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`max-w-[56ch] text-[length:var(--text-ui)] leading-[1.7] text-mute ${className}`}>{children}</p>;
}

/** A section with the rail label, the headline and the optional lead, then whatever follows. */
export function CopySection({ id, copy, children }: { id: string; copy: SectionCopy; children?: ReactNode }) {
  return (
    <Section id={id} title={copy.label}>
      <Reveal>
        <Headline>{copy.headline}</Headline>
        {copy.description && <Lead className="mt-5">{copy.description}</Lead>}
      </Reveal>
      {children && <div className="mt-12 lg:mt-16">{children}</div>}
    </Section>
  );
}

/** Numbered rows: 01, a title and a line, ruled apart. */
export function NumberedList({ items }: { items: readonly (Numbered | { title: string; blurb: string })[] }) {
  return (
    <ol className="text-[length:var(--text-ui)] leading-[1.7]">
      {items.map((it, i) => (
        <li key={it.title} className="grid grid-cols-[2.5rem_1fr] gap-x-5 border-t border-line py-7 first:border-t-0 first:pt-0 sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,2fr)]">
          <span aria-hidden className="text-mute tabular-nums">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="text-bone">{it.title}</span>
          <span className="col-start-2 text-soft sm:col-start-auto">{"body" in it ? it.body : it.blurb}</span>
        </li>
      ))}
    </ol>
  );
}

export const linkClass =
  "text-bone underline decoration-line-strong underline-offset-4 transition-colors duration-300 hover:decoration-bone focus-visible:decoration-bone";

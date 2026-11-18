import type { ReactNode } from "react";

type Props = {
  id: string;
  /** The section's label, set in the left rail as in the reference. It is the section's h2. */
  title: string;
  children: ReactNode;
  className?: string;
};

/**
 * The reference's one repeating layout: a hairline, then a grey label in a left rail and the content in
 * the wide column beside it. Below `lg` the rail stacks above the content.
 */
export function Section({ id, title, children, className = "" }: Props) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-[67px] border-t border-line">
      <div className={`gutter mx-auto grid max-w-[1920px] grid-cols-1 gap-x-5 gap-y-5 py-10 lg:grid-cols-[28.5%_1fr] ${className}`}>
        <h2 id={`${id}-title`} className="label">
          {title}
        </h2>
        <div>{children}</div>
      </div>
    </section>
  );
}

/** A small grey tag, as the reference sets its project categories and external-link marks. */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-[2px] bg-ink-3 px-1.5 py-[5px] text-[length:var(--text-chip)] font-medium leading-none tracking-[0.3px] text-mute">
      {children}
    </span>
  );
}

/** Marks a link that leaves the site: the visible "EXT" tag, and the words for a screen reader. */
export function Ext() {
  return (
    <>
      <span aria-hidden className="ml-2 align-middle">
        <Chip>EXT</Chip>
      </span>
      <span className="sr-only"> (opens in a new tab)</span>
    </>
  );
}

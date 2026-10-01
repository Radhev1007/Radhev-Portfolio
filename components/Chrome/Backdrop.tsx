/**
 * Page backdrop: the 12-column grid the layout is actually built on, drawn
 * as hairlines, plus a soft accent bloom and a fine grain.
 *
 * It sits behind everything at very low contrast — the aim is for the page
 * to feel measured rather than for anyone to consciously notice a grid.
 * Purely decorative, so it is inert and hidden from assistive tech.
 */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Column hairlines, aligned to the same max-width and gutter as the content. */}
      <div className="absolute inset-0 hidden gutter md:block">
        <div className="mx-auto grid h-full max-w-[1600px] grid-cols-12 gap-10">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-full border-l border-line last:border-r" />
          ))}
        </div>
      </div>

      {/* A single warm bloom, anchored off the top-right where the artwork sits. */}
      <div
        className="absolute -right-[10%] -top-[15%] size-[55vw] rounded-full opacity-[0.11] blur-[130px]"
        style={{ background: "radial-gradient(circle, var(--color-accent) 0%, transparent 70%)" }}
      />

      {/* Fine grain, so large flat areas do not band on wide displays. */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}

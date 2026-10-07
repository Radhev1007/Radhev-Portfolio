/**
 * Page backdrop: a soft accent bloom and a fine grain.
 *
 * This used to draw the 12-column grid as hairlines too. Across a full
 * viewport that is thirteen vertical rules sitting behind every section,
 * which read as clutter rather than as structure — the depth comes from the
 * bloom and the grain alone now. Purely decorative, so it is inert and
 * hidden from assistive tech.
 */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
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

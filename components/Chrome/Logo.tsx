/**
 * The identity mark — a geometric lowercase r with the accent on the stem's
 * foot. Geometry is kept identical to `app/icon.svg` so the tab icon and the
 * in-page logo stay the same drawing.
 *
 * The letterform uses `currentColor` and the foot uses the accent token, so
 * the mark follows the theme and any inverted section surface without needing
 * a second asset. The viewBox is cropped to the mark's own bounds, so it sits
 * on the text baseline instead of carrying the icon's square padding.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="26 24 50 56" className={className} fill="none" aria-hidden focusable="false">
      <g fill="currentColor">
        <rect x="26" y="24" width="17" height="56" />
        <path d="M36 24h12a28 28 0 0 1 28 28H59a11 11 0 0 0-11-11H36z" />
      </g>
      <rect x="26" y="68" width="17" height="12" fill="var(--color-accent)" />
    </svg>
  );
}

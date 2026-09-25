/**
 * Shared colours for the flat illustration set. Each maps to a CSS variable
 * defined per theme in styles/globals.css, so artwork follows light/dark.
 * (Animate colour changes with opacity overlays — CSS variables can't be tweened.)
 */
export const ill = {
  ink: "var(--ill-ink)",
  surface: "var(--ill-surface)",
  surface2: "var(--ill-surface2)",
  surface3: "var(--ill-surface3)",
  paper: "var(--ill-paper)",
  grey: "var(--ill-grey)",
  line: "var(--ill-line)",
  faint: "var(--ill-faint)",
  cyan: "var(--ill-cyan)",
  cyanSoft: "var(--ill-cyan-soft)",
} as const;

/** Server-safe theme constants (no React hooks here — used by app/layout.tsx). */

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "theme";
export const THEME_COLORS: Record<Theme, string> = { dark: "#000000", light: "#f5f2ea" };

/**
 * Runs before first paint (see app/layout.tsx) so the saved theme is applied
 * without a flash. Dark is the default; a saved choice always wins.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');document.documentElement.dataset.theme=(t==='light'||t==='dark')?t:'dark';}catch(e){document.documentElement.dataset.theme='dark';}})();`;

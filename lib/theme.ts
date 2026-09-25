"use client";

import { useSyncExternalStore } from "react";
import { THEME_COLORS, THEME_STORAGE_KEY, type Theme } from "./theme-config";

export type { Theme };

function read(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => "dark");
}

export function setTheme(theme: Theme) {
  const root = document.documentElement;
  // Cross-fade colours only while switching, so normal interactions keep their own timing.
  root.classList.add("theme-transition");
  root.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage unavailable — the choice still applies for this visit */
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  window.setTimeout(() => root.classList.remove("theme-transition"), 500);
}

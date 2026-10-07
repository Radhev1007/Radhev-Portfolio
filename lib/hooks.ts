"use client";

import { useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";

export function useMediaQuery(query: string, serverFallback = false) {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => serverFallback,
  );
}

/** True for mouse / trackpad devices that can hover precisely. */
export const useFinePointer = () => useMediaQuery("(hover: hover) and (pointer: fine)");

export type DeviceTier = "mobile" | "tablet" | "desktop";

export function useDeviceTier(): DeviceTier {
  const desktop = useMediaQuery("(min-width: 1024px)", true);
  const tablet = useMediaQuery("(min-width: 768px)", true);
  return desktop ? "desktop" : tablet ? "tablet" : "mobile";
}

/** Reduced-motion flag that is stable during SSR. */
export function usePrefersReducedMotion() {
  return useReducedMotion() ?? false;
}

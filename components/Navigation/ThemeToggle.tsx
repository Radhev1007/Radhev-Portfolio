"use client";

import { AnimatePresence, motion } from "framer-motion";
import { setTheme, useTheme } from "@/lib/theme";
import { ease } from "@/lib/motion";

/** Light/dark switch: a sun and moon that rotate past each other. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`relative grid size-10 place-items-center overflow-hidden rounded-full border border-bone/15 text-bone transition-colors duration-300 hover:border-bone/40 ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.svg
          key={theme}
          viewBox="0 0 24 24"
          className="size-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.35, ease: ease.outExpo }}
        >
          {theme === "dark" ? (
            // Moon — currently dark
            <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
          ) : (
            // Sun — currently light
            <>
              <circle cx="12" cy="12" r="4" />
              {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
                <line key={a} x1="12" y1="2.5" x2="12" y2="4.5" transform={`rotate(${a} 12 12)`} />
              ))}
            </>
          )}
        </motion.svg>
      </AnimatePresence>
    </button>
  );
}

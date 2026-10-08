"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The garage, opened from the nav rather than given a section of its own.
 *
 * The scene is behind a dynamic import with `ssr: false`, so the physics
 * engine, the terrain and the truck are only fetched once someone asks to go
 * in — the portfolio's own payload is unaffected by any of it.
 */
const GarageScene = dynamic(() => import("./GarageScene").then((m) => m.GarageScene), {
  ssr: false,
  loading: () => <Loading />,
});

/**
 * A control in the nav bar, sized to sit beside the menu button.
 *
 * It is a toggle, not a link: there is nothing to scroll to and nothing to
 * deep-link, so a nav item pretending to be a destination would be a small
 * lie about what the page contains.
 */
export function GarageLauncher({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // The page must not scroll underneath the scene.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open my garage — drive the RC crawler"
        title="My garage"
        data-cursor="cta"
        className={`group grid size-5 place-items-center text-bone transition-opacity duration-300 hover:opacity-100 ${className ?? ""}`}
      >
        <RcIcon />
      </button>

      {/* Portalled to the body on purpose. The scene is `fixed inset-0`, and a
          fixed element is positioned against its nearest transformed ancestor
          rather than the viewport — the header animates a transform, so inside
          it the garage would cover only part of the screen. */}
      {mounted &&
        open &&
        createPortal(<GarageScene onExit={() => setOpen(false)} />, document.body)}
    </>
  );
}

/** A crawler in nineteen strokes: body, roof, two wheels. */
function RcIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="size-5" fill="none">
      <path
        d="M2.4 11.6h15.2M3.6 11.6V9.4h12.8v2.2M6.2 9.4V6.9h7.6v2.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6.4" cy="13.4" r="1.9" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="13.6" cy="13.4" r="1.9" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function Loading() {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#0b0b0c] text-white">
      <div className="text-center">
        <p className="text-caption uppercase tracking-[0.18em] text-white/45">Radhev R — Garage</p>
        <p className="mt-4 text-caption uppercase tracking-[0.18em]">Loading experience…</p>
      </div>
    </div>
  );
}

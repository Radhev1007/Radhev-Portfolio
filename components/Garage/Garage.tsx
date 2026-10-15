"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The garage, opened from the nav rather than given a section of its own.
 *
 * It runs RC Crawler — the standalone three.js rock-crawling game, copied
 * into /public/rc-crawler — in a full-screen frame. Nothing of it loads until
 * someone asks to go in, so the portfolio's own payload is unaffected.
 */
const GAME_URL = "/rc-crawler/index.html";

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
        className={`group grid size-6 place-items-center text-bone transition-opacity duration-300 hover:opacity-100 ${className ?? ""}`}
      >
        <RcIcon />
      </button>

      {/* Portalled to the body on purpose. The scene is `fixed inset-0`, and a
          fixed element is positioned against its nearest transformed ancestor
          rather than the viewport — the header animates a transform, so inside
          it the garage would cover only part of the screen. */}
      {mounted &&
        open &&
        createPortal(<GameFrame onExit={() => setOpen(false)} />, document.body)}
    </>
  );
}

/**
 * A lifted 4×4 in side profile on a 24px grid: sloped windscreen, roof light
 * bar, the body riding clear of oversized tyres, and the accent as a tail
 * light. On hover the body rocks on its suspension — a hint that it drives.
 */
function RcIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-6 overflow-visible" fill="none">
      <g className="origin-bottom [transform-box:fill-box] group-hover:animate-[rock_0.6s_ease-in-out_infinite]">
        <path d="M3 13.6V10.6h4.4l2.3-4.1h6.5l2.5 4.1H21v3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M13.2 6.5v4.1M10.4 4.4h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="19.2" y="11.4" width="1" height="1.4" fill="var(--color-accent)" />
      </g>
      {[7, 17].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="17.6" r="2.9" stroke="currentColor" strokeWidth="1.5" />
          <circle cx={cx} cy="17.6" r="1" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

/**
 * The game in a full-screen frame with a way back out.
 *
 * The frame takes keyboard focus once it loads so the driving keys work
 * straight away. Escape works while focus is on this page; once the game has
 * it, the "Back to portfolio" button is always on top.
 */
function GameFrame({ onExit }: { onExit: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onExit();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#0b0b0c]" role="dialog" aria-modal="true" aria-label="RC Crawler game">
      {!ready && (
        <div className="absolute inset-0 grid place-items-center text-white">
          <div className="text-center">
            <p className="text-caption uppercase tracking-[0.18em] text-white/45">Radhev R — Garage</p>
            <p className="mt-4 text-caption uppercase tracking-[0.18em]">Loading experience…</p>
          </div>
        </div>
      )}
      <iframe
        ref={frame}
        src={GAME_URL}
        title="RC Crawler — drive the SCX30"
        allow="fullscreen; gamepad; autoplay"
        className="absolute inset-0 size-full border-0"
        onLoad={() => {
          setReady(true);
          frame.current?.contentWindow?.focus();
        }}
      />
      {/* Top centre: the game's own HUD holds all four corners. */}
      <button
        type="button"
        onClick={onExit}
        data-cursor="hover"
        className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-3 border border-white/25 bg-black/60 px-4 py-2 font-mono text-caption uppercase tracking-[0.12em] text-white backdrop-blur-sm transition-colors duration-300 hover:border-accent hover:bg-accent"
      >
        <span aria-hidden>←</span>
        Back to portfolio
        <span aria-hidden className="hidden border border-white/30 px-1.5 text-white/70 md:inline">Esc</span>
      </button>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
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
 * Online multiplayer runs on a separate server (multiplayer-server/). Its
 * WebSocket URL is baked in at build time; without it the game still runs,
 * and only the Multiplayer screen says no server is configured. On localhost
 * the game finds a local dev server by itself.
 */
const MULTIPLAYER_URL = process.env.NEXT_PUBLIC_RC_MULTIPLAYER_URL ?? "";

/** An invite link is this page with `?rc=CODE`: it opens the garage with the code filled in. */
function inviteCode(): string | null {
  if (typeof window === "undefined") return null;
  const code = new URLSearchParams(window.location.search).get("rc");
  return code && /^[A-Za-z0-9]{5}$/.test(code) ? code.toUpperCase() : null;
}

function gameSrc(join: string | null) {
  const q = new URLSearchParams();
  if (MULTIPLAYER_URL) q.set("mp", MULTIPLAYER_URL);
  if (join) q.set("join", join);
  const qs = q.toString();
  return qs ? `${GAME_URL}?${qs}` : GAME_URL;
}

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
  const [join, setJoin] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    // arriving from an invite link: go straight into the garage
    const code = inviteCode();
    if (code) {
      setJoin(code);
      setOpen(true);
    }
  }, []);

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
        createPortal(
          <GameFrame
            src={gameSrc(join)}
            onExit={() => {
              setOpen(false);
              setJoin(null);
            }}
          />,
          document.body,
        )}
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

type Orientation = "landscape" | "portrait";
type LockableOrientation = ScreenOrientation & { lock?: (o: Orientation) => Promise<void>; unlock?: () => void };

/**
 * The game in a full-screen frame with a way back out.
 *
 * The frame takes keyboard focus once it loads so the driving keys work
 * straight away. Escape works while focus is on this page; once the game has
 * it, the "Back to portfolio" button is always on top.
 *
 * On phones the game asks, as driving starts, to be turned sideways. Browsers
 * only lock the orientation in full screen, so this page puts the whole frame
 * — game and back button — in full screen and locks it to landscape. Where
 * that isn't allowed (iPhone Safari) the game asks the player to turn the
 * phone instead.
 *
 * The game's rotate button switches between landscape and portrait. Where the
 * orientation can't be locked, this page draws the frame sideways while the
 * phone is upright, so the game sees a landscape screen; turning the phone
 * then shows it the right way up. Touches inside a turned frame reach the game
 * in its own coordinates, so its controls need nothing special.
 */
function GameFrame({ src, onExit }: { src: string; onExit: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [turned, setTurned] = useState(false);
  const [view, setView] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const onResize = () => setView({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onExit();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type !== "rc:orientation" || !box.current) return;
      const want: Orientation = e.data.want === "portrait" ? "portrait" : "landscape";
      const el = box.current;
      let locked = false;
      try {
        // some browsers leave the full-screen request hanging instead of refusing it: give up after a moment
        await Promise.race([
          (async () => {
            if (!document.fullscreenElement) await el.requestFullscreen({ navigationUI: "hide" });
            const orientation = screen.orientation as LockableOrientation;
            if (orientation.lock) {
              await orientation.lock(want);
              locked = true;
            }
          })(),
          new Promise((_, fail) => setTimeout(() => fail(new Error("timed out")), 1500)),
        ]);
      } catch {
        // not allowed on this browser: turn the frame instead when asked to, else the game shows its card
      }
      if (want === "portrait" || locked) setTurned(false);
      else if (e.data.force) setTurned(true);
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      (screen.orientation as LockableOrientation | undefined)?.unlock?.();
    };
  }, []);

  // turned and held upright: the frame is drawn a quarter turn clockwise, so it reads as landscape
  const sideways: CSSProperties | undefined =
    turned && view && view.h > view.w
      ? {
          top: 0,
          left: 0,
          right: "auto",
          bottom: "auto",
          width: view.h,
          height: view.w,
          transformOrigin: "0 0",
          transform: `translateX(${view.w}px) rotate(90deg)`,
        }
      : undefined;

  return (
    <div
      ref={box}
      className="fixed inset-0 z-[100] bg-[#0b0b0c]"
      style={sideways}
      role="dialog"
      aria-modal="true"
      aria-label="RC Crawler game"
    >
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
        src={src}
        title="RC Crawler — drive the SCX30"
        allow="fullscreen; gamepad; autoplay; microphone; clipboard-write"
        className="absolute inset-0 size-full border-0"
        onLoad={() => {
          setReady(true);
          frame.current?.contentWindow?.focus();
        }}
      />
      {/* Phones: a small square in the top-left, which the game leaves free
          when embedded. Wider screens: a labelled pill at top centre, since
          the game's HUD holds all four corners there. */}
      <button
        type="button"
        onClick={onExit}
        aria-label="Back to portfolio"
        data-cursor="hover"
        className="absolute left-3 top-3 z-10 flex size-10 items-center justify-center gap-3 whitespace-nowrap border border-white/25 bg-black/60 font-mono text-caption uppercase tracking-[0.12em] text-white backdrop-blur-sm transition-colors duration-300 hover:border-accent hover:bg-accent md:left-1/2 md:top-4 md:size-auto md:-translate-x-1/2 md:px-4 md:py-2"
      >
        <span aria-hidden>←</span>
        <span className="hidden md:inline">Back to portfolio</span>
        <span aria-hidden className="hidden border border-white/30 px-1.5 text-white/70 md:inline">Esc</span>
      </button>
    </div>
  );
}

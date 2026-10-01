"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks";

/**
 * Full-bleed looping showreel behind the hero.
 *
 * Autoplay only works when the video is muted and inline, so both are set and
 * neither should be removed. The poster carries the first frame so the hero is
 * never empty on a slow connection, and `preload="none"` keeps the file off the
 * critical path — nothing downloads until the browser is idle enough to start.
 *
 * Anyone who has asked their OS for reduced motion gets the poster and no
 * playback at all, and everyone else gets a control to stop it.
 *
 * A scrim sits over the footage so the cream display type keeps its contrast
 * whatever the video happens to be showing underneath.
 */
export function HeroVideo({
  src = "/video/hero.mp4",
  webm = "/video/hero.webm",
  poster = "/video/hero-poster.jpg",
}: {
  src?: string;
  webm?: string;
  poster?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (reduced) {
      v.pause();
      setPlaying(false);
      return;
    }
    // Autoplay can still be refused; reflect what actually happened.
    v.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  }, [reduced, ready]);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().then(() => setPlaying(true), () => {});
    else {
      v.pause();
      setPlaying(false);
    }
  };

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <video
        ref={ref}
        className="size-full object-cover"
        poster={poster}
        muted
        loop
        playsInline
        preload="none"
        onLoadedData={() => setReady(true)}
      >
        <source src={webm} type="video/webm" />
        <source src={src} type="video/mp4" />
      </video>

      {/* Scrim: heavier on the left, where the display line and copy sit. It is
          tied to `ready` so that with no video file present the hero is left
          exactly as it was, rather than dimmed by a scrim over nothing. */}
      {ready && (
        <>
          <div className="absolute inset-0 bg-ink/75" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/70 to-ink/40" />
        </>
      )}

      {ready && !reduced && (
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause background video" : "Play background video"}
          className="pointer-events-auto absolute bottom-6 right-[var(--gutter)] z-10 grid size-9 place-items-center border border-line text-bone transition-colors duration-300 hover:border-bone/40"
        >
          {playing ? (
            <svg viewBox="0 0 24 24" className="size-[14px]" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4" height="14" />
              <rect x="14" y="5" width="4" height="14" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-[14px]" fill="currentColor" aria-hidden>
              <path d="M7 5l12 7-12 7z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useFinePointer, usePrefersReducedMotion } from "@/lib/hooks";

/** The WebGL ripple is loaded only once a cover is first hovered. */
const RippleDistortion = dynamic(() => import("@/components/RippleDistortion/RippleDistortion"), { ssr: false });

/**
 * A water-ripple layer over a project cover (React Bits' RippleDistortion, at the usage example's brush, strength,
 * swirl and rings). Each ripple renders continuously on WebGL, so it is only created when the cover is first
 * hovered, after the image has loaded, and taken down again once the cover scrolls out of view. Until then, and
 * on touch screens or for visitors who ask for reduced motion, the plain cover underneath is all there is.
 */
export function CoverRipple({ src }: { src: string }) {
  const finePointer = useFinePointer();
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !armed) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        setArmed(false);
        setShown(false);
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [armed]);

  if (!finePointer || reduced) return null;

  const arm = () => {
    if (armed) return;
    const img = new Image();
    img.onload = () => {
      setArmed(true);
      // give the canvas a frame to draw the image before it fades in over the plain cover
      window.setTimeout(() => setShown(true), 120);
    };
    img.src = src;
  };

  return (
    <div
      ref={ref}
      aria-hidden
      onPointerEnter={arm}
      className={`absolute inset-0 transition-opacity duration-500 ${shown ? "opacity-100" : "opacity-0"}`}
    >
      {armed && <RippleDistortion src={src} brushSize={150} strength={0.2} swirl={1} rings={4} grayscale={false} tintAmount={0} />}
    </div>
  );
}

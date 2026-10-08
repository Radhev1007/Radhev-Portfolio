"use client";

import { useCallback, useRef } from "react";
import type { Controls } from "./useControls";

/**
 * Driving controls for touch.
 *
 * Two thumb pads rather than a D-pad: this is a crawler, and the whole point
 * of one is placing the wheels deliberately, which a four-way pad cannot do.
 * Steering is the left pad's horizontal axis, throttle the right pad's
 * vertical, both analog and both spring-centred.
 *
 * Values go straight into the controls ref and the knob is moved by writing a
 * transform, so dragging a thumb never re-renders React — the driving loop
 * reads the ref every frame regardless.
 */

const TRAVEL = 34;

/** Capture can fail if the pointer has already gone; losing it is survivable. */
function capture(el: Element, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* no capture, but the move handler still tracks while the pointer is down */
  }
}

function Pad({
  axis,
  label,
  onValue,
  className,
}: {
  axis: "x" | "y";
  label: string;
  onValue: (v: number) => void;
  className?: string;
}) {
  const pad = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const holding = useRef<number | null>(null);

  const set = useCallback(
    (v: number) => {
      onValue(v);
      const k = knob.current;
      if (k) {
        k.style.transform =
          axis === "x" ? `translateX(${v * TRAVEL}px)` : `translateY(${-v * TRAVEL}px)`;
      }
    },
    [axis, onValue],
  );

  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = pad.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const raw =
      axis === "x"
        ? (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
        : -(e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    set(Math.max(-1, Math.min(1, raw)));
  };

  return (
    <div
      ref={pad}
      aria-label={label}
      className={`pointer-events-auto relative grid size-28 touch-none place-items-center rounded-full border border-white/20 bg-white/5 backdrop-blur-sm ${className ?? ""}`}
      onPointerDown={(e) => {
        holding.current = e.pointerId;
        capture(e.currentTarget, e.pointerId);
        track(e);
      }}
      onPointerMove={(e) => {
        if (holding.current === e.pointerId) track(e);
      }}
      onPointerUp={(e) => {
        if (holding.current !== e.pointerId) return;
        holding.current = null;
        set(0);
      }}
      onPointerCancel={() => {
        holding.current = null;
        set(0);
      }}
    >
      <span
        className={`absolute text-micro uppercase tracking-[0.2em] text-white/30 ${
          axis === "x" ? "-top-5" : "-top-5"
        }`}
      >
        {label}
      </span>
      <div
        ref={knob}
        className="size-11 rounded-full border border-white/35 bg-white/15 transition-none"
      />
    </div>
  );
}

function Hold({
  label,
  onChange,
  className,
}: {
  label: string;
  onChange: (down: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`pointer-events-auto touch-none rounded-full border border-white/20 bg-white/5 px-4 py-3 text-micro uppercase tracking-[0.18em] text-white/70 backdrop-blur-sm active:bg-white/20 ${className ?? ""}`}
      onPointerDown={(e) => {
        capture(e.currentTarget, e.pointerId);
        onChange(true);
      }}
      onPointerUp={() => onChange(false)}
      onPointerCancel={() => onChange(false)}
    >
      {label}
    </button>
  );
}

export function TouchControls({ controls }: { controls: React.RefObject<Controls> }) {
  const steer = useCallback(
    (v: number) => {
      controls.current.steerAxis = v;
    },
    [controls],
  );
  const throttle = useCallback(
    (v: number) => {
      controls.current.throttleAxis = v;
    },
    [controls],
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 select-none p-5 pb-8">
      <div className="mb-4 flex justify-center gap-3">
        <Hold label="Brake" onChange={(d) => (controls.current.brake = d)} />
        <Hold label="Boost" onChange={(d) => (controls.current.boost = d)} />
        <Hold label="Reset" onChange={(d) => (controls.current.reset = d)} />
      </div>
      <div className="flex items-end justify-between">
        <Pad axis="x" label="Steer" onValue={steer} />
        <Pad axis="y" label="Throttle" onValue={throttle} />
      </div>
    </div>
  );
}

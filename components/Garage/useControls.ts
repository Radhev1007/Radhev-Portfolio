"use client";

import { useEffect, useRef } from "react";

export type Controls = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
  boost: boolean;
  reset: boolean;
  interact: boolean;
};

const MAP: Record<string, keyof Controls> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "back",
  ArrowDown: "back",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "brake",
  ShiftLeft: "boost",
  ShiftRight: "boost",
  KeyR: "reset",
  KeyE: "interact",
};

const IDLE: Controls = {
  forward: false,
  back: false,
  left: false,
  right: false,
  brake: false,
  boost: false,
  reset: false,
  interact: false,
};

/**
 * Held keys in a ref, not state: the driving loop reads this every frame and
 * re-rendering React sixty times a second to move a car would be absurd.
 */
export function useControls(enabled = true) {
  const controls = useRef<Controls>({ ...IDLE });

  useEffect(() => {
    // Inspection mode suspends driving entirely rather than letting held keys
    // bleed through it, so the truck is where you left it when you come back.
    if (!enabled) {
      Object.assign(controls.current, IDLE);
      return;
    }

    const set = (code: string, value: boolean) => {
      const key = MAP[code];
      if (key) controls.current[key] = value;
    };
    const down = (e: KeyboardEvent) => {
      // Space and the arrows scroll the page underneath otherwise.
      if (MAP[e.code]) e.preventDefault();
      set(e.code, true);
    };
    const up = (e: KeyboardEvent) => set(e.code, false);
    const blur = () => Object.assign(controls.current, IDLE);

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    // Keys held while the tab loses focus would otherwise stick down forever.
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [enabled]);

  return controls;
}

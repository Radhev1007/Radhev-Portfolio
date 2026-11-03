// Gamepad controls (standard mapping: Xbox / PlayStation layouts). The left stick steers, the right trigger drives
// forward and the left trigger reverses (analogue, like an RC transmitter's throttle), A / Cross brakes. The other
// buttons press the same keys as the keyboard, once per press.
const DEAD = 0.12;   // stick deadzone: worn sticks rest a little off centre
const dz = (v) => (Math.abs(v) < DEAD ? 0 : Math.sign(v) * (Math.abs(v) - DEAD) / (1 - DEAD));

// standard-mapping button index -> keyboard key
const BUTTONS = { 1: 'r', 2: 'f', 3: 'c', 4: 'x', 5: 'g', 8: 'n', 9: 'escape', 12: 'l', 13: 'v' };
//                B recover, X get out/in, Y camera, LB diffs, RB range, Back map, Start menu, D-up lights, D-down dig

/** Driving input from one gamepad's state. */
export function padState(p) {
  const b = (i) => p.buttons[i] || { pressed: false, value: 0 };
  const throttle = b(7).value - b(6).value;   // right trigger forward, left trigger reverse
  return { throttle: Math.max(-1, Math.min(1, throttle)), steer: -dz(p.axes[0] || 0) || 0, handbrake: b(0).pressed };
}

export class Gamepad {
  constructor() { this.held = new Set(); }
  /** Fire `press(key)` for buttons pressed since the last poll. */
  poll(p, press) {
    for (const [i, key] of Object.entries(BUTTONS)) {
      const down = !!p.buttons[i]?.pressed;
      if (down && !this.held.has(i)) press(key);
      if (down) this.held.add(i); else this.held.delete(i);
    }
  }
}

/** The first connected standard gamepad, if any (browser only). */
export function firstPad() {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
  for (const p of navigator.getGamepads()) if (p && p.connected) return p;
  return null;
}

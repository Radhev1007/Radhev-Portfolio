/**
 * The RC collection.
 *
 * An array rather than a single object because the garage is built to hold
 * more than one truck — adding the next one is a new entry here and nothing
 * else. The first entry is the hero vehicle: the one you drive, the one on
 * the display plinth, and the one the inspector opens.
 *
 * Scale and dimensions are Axial's published figures for AXI-2261.
 */
export type RcVehicle = {
  id: string;
  /** Collection number, shown on the card. */
  number: string;
  name: string;
  category: string;
  scale: string;
  status: string;
  description: string;
  /** The three lines stencilled on the display plinth. */
  plinth: readonly [string, string, string];
  /** The line shown when you pull up alongside it. */
  tagline: string;
};

export const rcCollection: readonly RcVehicle[] = [
  {
    id: "scx30",
    number: "01",
    name: "Axial SCX30",
    category: "RC Crawler",
    scale: "1/30",
    status: "Favorite",
    description:
      "A compact crawler built for technical trails, obstacles and exploring terrain.",
    plinth: ["Axial SCX30", "RC Crawler", "My favorite"],
    tagline: "One of my favorite RC crawlers.",
  },
] as const;

export const heroVehicle = rcCollection[0];

/**
 * Where the inspector pins its labels, in game units on the vehicle's own
 * frame. Taken from the model's millimetre coordinates times the scale in
 * `Scx30.tsx`, not placed by eye.
 */
export const inspectPoints = [
  { label: "Body", at: [0.44, 0.44, -0.06] },
  { label: "Wheels", at: [-0.46, 0.18, -0.53] },
  { label: "Suspension", at: [0.3, 0.33, 0.53] },
  { label: "Roof rack", at: [0, 0.86, 0.18] },
  { label: "Light bar", at: [0, 0.73, -0.26] },
  { label: "Chassis", at: [-0.3, 0.19, 0.08] },
] as const;

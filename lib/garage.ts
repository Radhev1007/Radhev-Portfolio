/**
 * The RC collection.
 *
 * An array rather than a single object because the garage is built to hold
 * more than one truck — adding the next one is a new entry here and nothing
 * else. The first entry is the hero vehicle: the one you drive, the one on
 * the display plinth, and the one the inspector opens.
 *
 * Radhev: SCALE is the SCX24's 1/24. Correct it here if yours differs.
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
    scale: "1/24",
    status: "Favorite",
    description:
      "A compact crawler built for technical trails, obstacles and exploring terrain.",
    plinth: ["Axial SCX30", "RC Crawler", "My favorite"],
    tagline: "One of my favorite RC crawlers.",
  },
] as const;

export const heroVehicle = rcCollection[0];

/** Where the inspector pins its labels, in the model's own coordinates. */
export const inspectPoints = [
  { label: "Body", at: [0.42, 0.34, 0.12] },
  { label: "Wheels", at: [-0.5, 0.02, -0.58] },
  { label: "Suspension", at: [0.38, 0.04, 0.58] },
  { label: "Roof rack", at: [0, 0.78, 0.22] },
  { label: "Light bar", at: [0, 0.66, -0.42] },
] as const;

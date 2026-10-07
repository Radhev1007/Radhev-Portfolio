import { useTransform, type MotionValue, type Transition, type Variants } from "framer-motion";

/** Shared easing curves — keep motion consistent across the site. */
export const ease = {
  outExpo: [0.16, 1, 0.3, 1] as const,
  inOutQuart: [0.76, 0, 0.24, 1] as const,
  outQuart: [0.25, 1, 0.5, 1] as const,
};

export const duration = { fast: 0.35, base: 0.7, slow: 1.1, cinematic: 1.4 };

/** Hero entrance choreography (seconds from first paint): label → headline → illustration → copy → nav. */
export const intro = {
  background: 0,
  label: 0.3,
  title: 0.45,
  objects: 0.85,
  supporting: 1.0,
  cta: 1.15,
  nav: 1.5,
} as const;

export const transition = (delay = 0, d = duration.base): Transition => ({
  duration: d,
  delay,
  ease: ease.outExpo,
});

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: (delay: number = 0) => ({ opacity: 1, y: 0, transition: transition(delay) }),
};

export const blurIn: Variants = {
  hidden: { opacity: 0, filter: "blur(12px)", y: 16 },
  show: (delay: number = 0) => ({
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    transition: transition(delay, duration.slow),
  }),
};

export const stagger = (each = 0.08, delayChildren = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: each, delayChildren } },
});

export const viewportOnce = { once: true, margin: "0px 0px -12% 0px" } as const;

/**
 * Scroll-linked transform whose keyframes always span the full 0…1 input.
 * framer-motion accelerates scroll animations natively; partial ranges
 * (e.g. [0, 0.4]) don't clamp reliably there, so pad both ends explicitly.
 */
export function useScrollRange<T extends number | string>(value: MotionValue<number>, input: number[], output: T[]) {
  const i = [...input];
  const o = [...output];
  if (i[0] > 0) {
    i.unshift(0);
    o.unshift(o[0]);
  }
  if (i[i.length - 1] < 1) {
    i.push(1);
    o.push(o[o.length - 1]);
  }
  return useTransform(value, i, o);
}

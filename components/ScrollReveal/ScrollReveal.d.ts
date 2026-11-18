import type { ReactNode, RefObject } from "react";

export type ScrollRevealProps = {
  children?: ReactNode;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  enableBlur?: boolean;
  baseOpacity?: number;
  baseRotation?: number;
  blurStrength?: number;
  baseOffset?: number;
  stagger?: number;
  smoothing?: number;
  splitBy?: "words" | "chars" | "lines";
  effect?: "fade" | "rise" | "flip" | "scale";
  mode?: "scrub" | "enter";
  duration?: number;
  highlightColor?: string | null;
  containerClassName?: string;
  textClassName?: string;
  rotationEnd?: string;
  wordAnimationEnd?: string;
};

declare const ScrollReveal: (props: ScrollRevealProps) => React.JSX.Element;
export default ScrollReveal;

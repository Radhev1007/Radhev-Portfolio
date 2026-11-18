import type { HTMLAttributes, RefObject } from "react";

export type LaserFlowProps = HTMLAttributes<HTMLDivElement> & {
  surfaceRef?: RefObject<HTMLElement | null>;
  beamPosition?: number;
  surfaceLevel?: number;
  color?: string;
  intensity?: number;
  beamWidth?: number;
  flare?: number;
  spread?: number;
  spill?: number;
  fog?: number;
  dust?: number;
  streaks?: number;
  dots?: number;
  pulse?: number;
  speed?: number;
  seed?: number;
  mouseInteraction?: boolean;
  revealImage?: string;
  revealRadius?: number;
  revealOpacity?: number;
  intro?: boolean;
  theme?: "dark" | "light";
  paused?: boolean;
  dpr?: number;
};

export declare const LaserFlow: (props: LaserFlowProps) => React.JSX.Element;
declare const _default: typeof LaserFlow;
export default _default;

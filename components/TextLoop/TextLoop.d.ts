import type { CSSProperties } from "react";

export type TextLoopProps = {
  text?: string;
  shape?: "wave" | "circle" | "infinity" | "arch" | "line";
  path?: string;
  speed?: number;
  direction?: "forward" | "reverse";
  separator?: string;
  curviness?: number;
  tilt?: number;
  cross?: boolean;
  crossColor?: string;
  crossAngle?: number;
  draggable?: boolean;
  scrollBoost?: number;
  fontSize?: number;
  fontWeight?: number;
  letterSpacing?: number;
  uppercase?: boolean;
  outline?: boolean;
  outlineWidth?: number;
  color?: string;
  ribbon?: boolean;
  ribbonColor?: string;
  ribbonWidth?: number;
  edgeFade?: number;
  pauseOnHover?: boolean;
  className?: string;
  style?: CSSProperties;
};

declare const TextLoop: (props: TextLoopProps) => React.JSX.Element;
export default TextLoop;

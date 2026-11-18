import type { CSSProperties } from "react";

export type RippleDistortionProps = {
  src?: string;
  brushSize?: number;
  strength?: number;
  swirl?: number;
  rings?: number;
  spread?: number;
  fade?: number;
  spacing?: number;
  dispersion?: number;
  glint?: number;
  tint?: string;
  tintAmount?: number;
  highlightColor?: string;
  grayscale?: boolean;
  trigger?: "hover" | "click" | "both";
  clickStrength?: number;
  quality?: "low" | "medium" | "high";
  enabled?: boolean;
  className?: string;
  style?: CSSProperties;
};

declare const RippleDistortion: (props: RippleDistortionProps) => React.JSX.Element;
export default RippleDistortion;

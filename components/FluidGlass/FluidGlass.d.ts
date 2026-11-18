import type { CSSProperties, ReactNode } from "react";

export type FluidGlassShape = "torus" | "lens" | "blob" | "pill" | "cube" | "prism" | "diamond";

export type FluidGlassProps = {
  text?: string;
  textColor?: string;
  fontFamily?: string;
  fontWeight?: number | string;
  fontSize?: number;
  src?: string;
  fit?: "cover" | "contain";
  background?: string;
  shape?: FluidGlassShape;
  shapes?: FluidGlassShape[];
  size?: number;
  refraction?: number;
  dispersion?: number;
  reflection?: number;
  frost?: number;
  color?: string;
  tint?: number;
  shadow?: number;
  elevation?: number;
  interaction?: "follow" | "drag" | "static";
  smoothness?: number;
  wobble?: number;
  spin?: number;
  idle?: boolean;
  morphOnClick?: boolean;
  onShapeChange?: (shape: FluidGlassShape) => void;
  position?: [number, number];
  intro?: boolean;
  maxDevicePixelRatio?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

declare const FluidGlass: (props: FluidGlassProps) => React.JSX.Element;
export default FluidGlass;

import type { CSSProperties } from "react";

export type DitherVeilProps = {
  src?: string;
  fit?: "contain" | "cover";
  pattern?: "bayer" | "noise" | "atkinson" | "floyd" | "lines";
  palette?: "duotone" | "rgb";
  pixelSize?: number;
  levels?: number;
  inkColor?: string;
  paperColor?: string;
  contrast?: number;
  brightness?: number;
  revealRadius?: number;
  softness?: number;
  linger?: number;
  rimColor?: string;
  rim?: number;
  reverse?: boolean;
  wander?: boolean;
  clickBurst?: boolean;
  className?: string;
  style?: CSSProperties;
};

declare const DitherVeil: (props: DitherVeilProps) => React.JSX.Element;
export default DitherVeil;

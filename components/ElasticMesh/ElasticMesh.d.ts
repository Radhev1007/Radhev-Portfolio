import type { CSSProperties, HTMLAttributes } from "react";

export type ElasticMeshProps = {
  text?: string;
  src?: string;
  fontFamily?: string;
  fontWeight?: number;
  color?: string;
  imageColors?: boolean;
  material?: "balloon" | "chrome" | "jelly" | "clay";
  inflate?: number;
  stiffness?: number;
  wobble?: number;
  grabRadius?: number;
  stretch?: number;
  press?: number;
  shadow?: number;
  intro?: boolean;
  theme?: "dark" | "light";
  dpr?: number;
  /** Called once, after the first frame that draws the shape. */
  onReady?: () => void;
  className?: string;
  style?: CSSProperties;
} & Omit<HTMLAttributes<HTMLDivElement>, "className" | "style">;

/** React Bits ElasticMesh (JavaScript + CSS variant): text or an image inflated into an elastic, poke-able WebGL mesh. */
declare const ElasticMesh: (props: ElasticMeshProps) => JSX.Element;
export default ElasticMesh;

import type { CSSProperties } from "react";

export type SplashCursorProps = {
  colors?: string[];
  rainbow?: boolean;
  colorSpeed?: number;
  intensity?: number;
  size?: number;
  force?: number;
  swirl?: number;
  trail?: number;
  momentum?: number;
  shading?: number;
  glow?: number;
  quality?: "low" | "medium" | "high";
  clickSplash?: boolean;
  intro?: boolean;
  contained?: boolean;
  theme?: "dark" | "light";
  zIndex?: number;
  className?: string;
  style?: CSSProperties;
};

/** React Bits SplashCursor (JavaScript + CSS variant): a fluid simulation that your cursor stirs and your clicks splash. */
declare function SplashCursor(props: SplashCursorProps): JSX.Element;
export default SplashCursor;

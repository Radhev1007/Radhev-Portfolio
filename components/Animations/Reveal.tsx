"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { blurIn, fadeUp, viewportOnce } from "@/lib/motion";

type Props = HTMLMotionProps<"div"> & { delay?: number; blur?: boolean };

/** Fades (and optionally de-blurs) content upward once it enters the viewport. */
export function Reveal({ delay = 0, blur, children, ...rest }: Props) {
  return (
    <motion.div
      variants={blur ? blurIn : fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      custom={delay}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

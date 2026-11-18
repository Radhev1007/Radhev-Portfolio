"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { ease } from "@/lib/motion";

/** A short fade-and-rise as each page mounts, so moving between the homepage and a case study is not a hard cut. */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: ease.outExpo }}>
      {children}
    </motion.div>
  );
}

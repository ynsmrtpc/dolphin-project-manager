"use client";

import { motion, useReducedMotion } from "motion/react";

/** Rota degisiminde sayfa icerigi kisa bir gecisle yerine oturur. */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0.15 : 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

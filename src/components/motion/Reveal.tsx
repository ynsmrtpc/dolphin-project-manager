"use client";

import { motion, useReducedMotion } from "motion/react";

import {
  fadeUp,
  reducedFade,
  staggerContainer,
} from "@/components/motion/motion-presets";

type Props = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

/** Tek bir blogu sessizce iceri alir. */
export function Reveal({ children, className, delay = 0 }: Props) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={reduced ? reducedFade : fadeUp}
      initial="hidden"
      animate="show"
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

/** Liste kabi: cocuklarini kisa araliklarla acar. */
export function StaggerGroup({ children, className }: Props) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={reduced ? undefined : staggerContainer}
      initial={reduced ? undefined : "hidden"}
      animate={reduced ? undefined : "show"}
    >
      {children}
    </motion.div>
  );
}

/** StaggerGroup icindeki tek bir oge. */
export function StaggerItem({ children, className }: Props) {
  const reduced = useReducedMotion();

  return (
    <motion.div className={className} variants={reduced ? reducedFade : fadeUp}>
      {children}
    </motion.div>
  );
}

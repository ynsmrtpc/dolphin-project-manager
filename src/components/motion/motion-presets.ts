import type { Transition, Variants } from "motion/react";

/** Tum arayuz ayni ritmi paylasir: kisa, tek yonlu, abartisiz. */
export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const QUICK: Transition = { duration: 0.24, ease: EASE };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: QUICK },
  exit: { opacity: 0, y: -4, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.028 } },
};

/** Hareket azaltma tercihi acikken yalnizca opaklik degisir. */
export const reducedFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

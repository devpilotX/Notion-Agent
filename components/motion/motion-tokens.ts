import type { Variants } from "framer-motion";

export type Bezier = [number, number, number, number];

/** Organic entrance easing, cubic-bezier(0.22, 1, 0.36, 1). */
export const easeOrganic: Bezier = [0.22, 1, 0.36, 1];
/** Soft in-out for idle sway. */
export const easeSway: Bezier = [0.37, 0, 0.63, 1];

export const durations = {
  micro: 0.15,
  standard: 0.28,
} as const;

/** Cards grow in: fade up with a slight scale, optional stagger delay. */
export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  show: (delay = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55, ease: easeOrganic, delay },
  }),
};

/** Container that staggers its children like leaves settling. */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: easeOrganic },
  },
};

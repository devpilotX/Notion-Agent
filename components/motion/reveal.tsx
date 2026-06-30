"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import {
  revealVariants,
  staggerContainer,
  staggerItem,
} from "./motion-tokens";

type RevealProps = HTMLMotionProps<"div"> & { delay?: number };

/** Single element that grows in (fade up + slight scale) when scrolled into view. */
export function Reveal({ children, delay = 0, ...props }: RevealProps) {
  return (
    <motion.div
      variants={revealVariants}
      custom={delay}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Container whose direct <StaggerItem> children settle in one after another. */
export function StaggerGroup({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -6% 0px" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={staggerItem} {...props}>
      {children}
    </motion.div>
  );
}

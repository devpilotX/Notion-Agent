"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { easeOrganic } from "@/components/motion/motion-tokens";

/** Starter suggestion chip with soft organic radii and a gentle hover sway. */
export function Chip({
  className,
  children,
  ...props
}: HTMLMotionProps<"button">) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -2, rotate: -1 }}
      whileTap={{ scale: 0.98, rotate: 0 }}
      transition={{ duration: 0.25, ease: easeOrganic }}
      className={cn(
        "rounded-[14px] rounded-tl-[20px] border border-line bg-paper px-3.5 py-2 text-left text-sm text-stone",
        "shadow-soft transition-colors hover:border-moss hover:text-bark",
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}

/** Tiny static label, e.g. free / paid tier tags. */
export function Tag({
  tone = "moss",
  className,
  children,
}: {
  tone?: "moss" | "sun" | "canopy";
  className?: string;
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    moss: "bg-moss/15 text-canopy",
    canopy: "bg-canopy/12 text-canopy",
    sun: "bg-sun/20 text-bark",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

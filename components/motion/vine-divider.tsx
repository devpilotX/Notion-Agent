"use client";

import { motion } from "framer-motion";
import { easeOrganic } from "./motion-tokens";
import { cn } from "@/lib/utils";

/**
 * A thin vine that grows across as the section reveals.
 * Stretches to full width; stroke stays crisp via non-scaling-stroke.
 */
export function VineDivider({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-full text-line", className)}
      viewBox="0 0 600 16"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <motion.path
        d="M2 9C80 3 140 14 220 9S380 3 470 9 560 13 598 9"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true, margin: "0px 0px -4% 0px" }}
        transition={{ duration: 1.05, ease: easeOrganic }}
      />
      {[150, 320, 468].map((x, i) => (
        <motion.path
          key={x}
          d={`M${x} 9c-3-5-9-6-12-3 3 5 9 6 12 3Z`}
          className="fill-moss stroke-moss"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
          initial={{ opacity: 0, scale: 0 }}
          whileInView={{ opacity: 0.7, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, ease: easeOrganic, delay: 0.65 + i * 0.12 }}
        />
      ))}
    </svg>
  );
}

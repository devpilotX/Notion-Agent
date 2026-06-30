"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Leaf } from "@/components/icons";
import { easeOrganic } from "@/components/motion/motion-tokens";
import { cn } from "@/lib/utils";

export function Toggle({
  checked,
  onCheckedChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /** Accessible name for the switch. */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300",
        checked ? "bg-fern" : "bg-line",
        disabled && "opacity-50",
        className,
      )}
    >
      <motion.span
        className="grid h-5 w-5 place-items-center rounded-full bg-paper shadow-soft"
        animate={{ x: checked ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 520, damping: 34 }}
      >
        <AnimatePresence initial={false}>
          {checked && (
            <motion.span
              key="leaf"
              initial={{ scale: 0, rotate: -90, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0, rotate: -90, opacity: 0 }}
              transition={{ duration: 0.28, ease: easeOrganic }}
              className="text-canopy"
            >
              <Leaf size={12} strokeWidth={1.9} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>
    </button>
  );
}

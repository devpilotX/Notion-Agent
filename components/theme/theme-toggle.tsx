"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "./theme-provider";
import { Sun, Moon } from "@/components/icons";
import { easeOrganic } from "@/components/motion/motion-tokens";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light" : "Dark"}
      className={cn(
        "relative grid h-9 w-9 place-items-center rounded-[12px] text-stone",
        "border border-line bg-paper/70 backdrop-blur-sm",
        "transition-colors hover:text-canopy hover:bg-paper",
        "active:scale-95",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? "moon" : "sun"}
          initial={{ opacity: 0, rotate: -40, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 40, scale: 0.6 }}
          transition={{ duration: 0.28, ease: easeOrganic }}
          className="absolute inset-0 grid place-items-center"
        >
          {isDark ? <Moon size={18} /> : <Sun size={18} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

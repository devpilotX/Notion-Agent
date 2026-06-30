"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useDismiss } from "@/lib/use-dismiss";
import { easeOrganic } from "@/components/motion/motion-tokens";
import { cn } from "@/lib/utils";

export type MenuItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  onSelect: () => void;
};

export function Menu({
  items,
  ariaLabel,
  align = "end",
  children,
}: {
  items: MenuItem[];
  ariaLabel: string;
  align?: "start" | "end";
  /** Trigger content (rendered inside a button). */
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), containerRef);

  const run = (item: MenuItem) => {
    item.onSelect();
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="grid h-9 w-9 place-items-center rounded-[12px] text-stone transition-colors hover:bg-canopy/10 hover:text-canopy"
      >
        {children}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label={ariaLabel}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: easeOrganic }}
            style={{ transformOrigin: align === "end" ? "top right" : "top left" }}
            className={cn(
              "absolute top-full z-50 mt-2 min-w-44 rounded-[14px] border border-line bg-paper p-1.5 shadow-lift",
              align === "end" ? "right-0" : "left-0",
            )}
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                onClick={() => run(item)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-sm transition-colors",
                  item.danger
                    ? "text-danger hover:bg-danger/10"
                    : "text-bark hover:bg-canopy/10 hover:text-canopy",
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

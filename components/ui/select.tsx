"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Check } from "@/components/icons";
import { Tag } from "./chip";
import { useDismiss } from "@/lib/use-dismiss";
import { easeOrganic } from "@/components/motion/motion-tokens";
import { cn } from "@/lib/utils";

export type SelectOption = { id: string; label: string; tier?: "free" | "paid" };
export type SelectGroup = { provider: string; options: SelectOption[] };

export function Select({
  groups,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  groups: SelectGroup[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const flat = React.useMemo(() => groups.flatMap((g) => g.options), [groups]);
  const current = flat.find((o) => o.id === value) ?? flat[0];

  useDismiss(open, () => setOpen(false), containerRef);

  React.useEffect(() => {
    if (open) {
      const idx = flat.findIndex((o) => o.id === value);
      setActive(idx < 0 ? 0 : idx);
    }
  }, [open, flat, value]);

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(flat[active].id);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-[12px] border border-line bg-paper px-3 text-sm text-bark transition-colors hover:border-moss"
      >
        <span className="flex items-center gap-2">
          {current?.label}
          {current?.tier && (
            <Tag tone={current.tier === "free" ? "moss" : "sun"}>{current.tier}</Tag>
          )}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: easeOrganic }}
          className="text-stone"
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label={ariaLabel}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: easeOrganic }}
            style={{ transformOrigin: "top" }}
            className="verdant-scroll absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-[14px] border border-line bg-paper p-1.5 shadow-lift"
          >
            {groups.map((g) => (
              <li key={g.provider} role="group" aria-label={g.provider}>
                <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone/70">
                  {g.provider}
                </div>
                {g.options.map((o) => {
                  const idx = flat.findIndex((f) => f.id === o.id);
                  const selected = o.id === value;
                  const isActive = idx === active;
                  return (
                    <div
                      key={o.id}
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => choose(o.id)}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-2 rounded-[10px] px-2.5 py-2 text-sm transition-colors",
                        isActive ? "bg-canopy/10" : "",
                      )}
                    >
                      <span className="flex items-center gap-2 text-bark">
                        {o.label}
                        {o.tier && (
                          <Tag tone={o.tier === "free" ? "moss" : "sun"}>
                            {o.tier}
                          </Tag>
                        )}
                      </span>
                      {selected && <Check size={15} className="text-canopy" />}
                    </div>
                  );
                })}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

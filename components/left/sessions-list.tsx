"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { useSessions } from "@/lib/api/sessions";
import { easeOrganic } from "@/components/motion/motion-tokens";
import { cn } from "@/lib/utils";

const LIMIT = 5;

export function SessionsList({
  activeId,
  onSelect,
}: {
  activeId?: string | null;
  onSelect: (id: string) => void;
}) {
  const { sessions } = useSessions();
  const [showAll, setShowAll] = React.useState(false);
  const shown = showAll ? sessions : sessions.slice(0, LIMIT);

  return (
    <section aria-label="Recent sessions" className="px-3">
      {sessions.length === 0 && (
        <p className="px-3 py-2 text-xs text-stone">No sessions yet.</p>
      )}
      <StaggerGroup className="flex flex-col gap-0.5">
        {shown.map((s) => {
          const active = activeId ? activeId === s.id : Boolean(s.active);
          return (
            <StaggerItem key={s.id}>
              <motion.button
                type="button"
                onClick={() => onSelect(s.id)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                transition={{ duration: 0.2, ease: easeOrganic }}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "w-full rounded-[12px] px-3 py-2.5 text-left transition-colors",
                  active ? "bg-canopy/10" : "hover:bg-canopy/5",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-bark">
                    {s.title}
                  </span>
                  <span className="shrink-0 text-[11px] text-stone">{s.when}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-stone">{s.preview}</p>
              </motion.button>
            </StaggerItem>
          );
        })}
      </StaggerGroup>
      {sessions.length > LIMIT && (
        <div className="px-1 pt-1">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="rounded-[10px] px-2 py-1.5 text-xs font-medium text-canopy transition-colors hover:underline"
          >
            {showAll ? "Show less" : `Show all (${sessions.length})`}
          </button>
        </div>
      )}
    </section>
  );
}

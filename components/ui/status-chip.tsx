import * as React from "react";
import { cn } from "@/lib/utils";
import type { KeyStatus } from "@/lib/fixtures";

const MAP: Record<
  KeyStatus,
  { label: string; text: string; bg: string; dot: string; pulse?: boolean }
> = {
  working: {
    label: "Working",
    text: "text-canopy",
    bg: "bg-fern/12",
    dot: "bg-fern",
    pulse: true,
  },
  invalid: {
    label: "Invalid",
    text: "text-danger",
    bg: "bg-danger/12",
    dot: "bg-danger",
  },
  "rate-limited": {
    label: "Rate-limited",
    text: "text-bark",
    bg: "bg-sun/20",
    dot: "bg-sun",
  },
  unknown: {
    label: "Unchecked",
    text: "text-stone",
    bg: "bg-stone/10",
    dot: "bg-moss",
  },
};

export function StatusChip({
  status,
  className,
}: {
  status: KeyStatus;
  className?: string;
}) {
  const s = MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        s.bg,
        s.text,
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          s.dot,
          s.pulse && "animate-status-pulse",
        )}
      />
      {s.label}
    </span>
  );
}

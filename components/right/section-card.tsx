"use client";

import * as React from "react";
import { Reveal } from "@/components/motion/reveal";
import { Card } from "@/components/ui/card";
import { VineDivider } from "@/components/motion/vine-divider";
import { cn } from "@/lib/utils";

export function SectionCard({
  icon,
  title,
  subtitle,
  delay = 0,
  alt = false,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  delay?: number;
  alt?: boolean;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Reveal delay={delay}>
      <Card alt={alt} className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-canopy/10 text-canopy">
              {icon}
            </span>
            <div>
              <h3 className="text-[15px] font-semibold leading-tight text-bark">
                {title}
              </h3>
              {subtitle && (
                <p className="mt-1 text-sm leading-relaxed text-stone">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action}
        </div>

        <div className="my-4">
          <VineDivider />
        </div>

        {children}
      </Card>
    </Reveal>
  );
}

export function SettingRow({
  icon,
  label,
  hint,
  control,
  last = false,
}: {
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  control: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-3",
        !last && "border-b border-line/70",
      )}
    >
      <div className="flex items-start gap-3">
        {icon && <span className="mt-0.5 text-moss">{icon}</span>}
        <div>
          <p className="text-sm font-medium text-bark">{label}</p>
          {hint && <p className="mt-0.5 text-xs text-stone">{hint}</p>}
        </div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

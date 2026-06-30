"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const IconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }
>(function IconButton({ className, danger, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-[12px] text-stone transition-colors active:scale-95",
        danger
          ? "hover:bg-danger/10 hover:text-danger"
          : "hover:bg-canopy/10 hover:text-canopy",
        className,
      )}
      {...props}
    />
  );
});

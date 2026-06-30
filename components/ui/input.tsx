"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-[12px] border border-line bg-paper px-3 text-sm text-bark",
        "placeholder:text-stone/70",
        "transition-colors duration-200",
        "hover:border-moss/70 focus:border-fern",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full resize-none rounded-[14px] border border-line bg-paper px-3.5 py-3 text-sm leading-relaxed text-bark",
        "placeholder:text-stone/70",
        "transition-colors duration-200",
        "hover:border-moss/70 focus:border-fern",
        className,
      )}
      {...props}
    />
  );
});

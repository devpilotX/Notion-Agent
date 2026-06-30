import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  alt,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { alt?: boolean }) {
  return (
    <div
      className={cn(
        "border border-line bg-paper shadow-soft",
        alt ? "radius-leaf-alt" : "radius-leaf",
        className,
      )}
      {...props}
    />
  );
}

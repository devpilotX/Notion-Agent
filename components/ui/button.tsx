"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 overflow-hidden rounded-[12px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-canopy text-canopy-contrast shadow-soft hover:brightness-[1.06]",
        outline:
          "border border-line bg-paper text-bark hover:border-moss hover:text-canopy",
        ghost: "text-stone hover:bg-canopy/10 hover:text-canopy",
        danger: "text-danger hover:bg-danger/10",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-5 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Ripple = { x: number; y: number; id: number };

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref" | "children">,
    VariantProps<typeof buttonVariants> {
  /** Disable the water-drop ripple (on by default). */
  noRipple?: boolean;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant, size, noRipple, onPointerDown, children, ...props },
    ref,
  ) {
    const [ripples, setRipples] = React.useState<Ripple[]>([]);

    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!noRipple) {
        const rect = e.currentTarget.getBoundingClientRect();
        setRipples((r) => [
          ...r,
          { x: e.clientX - rect.left, y: e.clientY - rect.top, id: Date.now() + Math.random() },
        ]);
      }
      onPointerDown?.(e);
    };

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className={cn(buttonVariants({ variant, size }), className)}
        onPointerDown={handlePointerDown}
        {...props}
      >
        {!noRipple &&
          ripples.map((r) => (
            <motion.span
              key={r.id}
              aria-hidden
              className="pointer-events-none absolute rounded-full bg-fern/30"
              style={{ left: r.x - 6, top: r.y - 6, width: 12, height: 12 }}
              initial={{ scale: 0, opacity: 0.5 }}
              animate={{ scale: 12, opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              onAnimationComplete={() =>
                setRipples((list) => list.filter((x) => x.id !== r.id))
              }
            />
          ))}
        <span className="relative inline-flex items-center gap-2">{children}</span>
      </motion.button>
    );
  },
);

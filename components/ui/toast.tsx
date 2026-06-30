"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Close, Leaf } from "@/components/icons";
import { easeOrganic } from "@/components/motion/motion-tokens";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "danger";

type ToastItem = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

const ToastContext = React.createContext<{ toast: (t: ToastInput) => void } | null>(
  null,
);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const ICON: Record<ToastVariant, { node: React.ReactNode; cls: string }> = {
  default: { node: <Leaf size={16} />, cls: "bg-moss/15 text-canopy" },
  success: { node: <Check size={16} />, cls: "bg-fern/15 text-canopy" },
  danger: { node: <Close size={16} />, cls: "bg-danger/15 text-danger" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const remove = React.useCallback(
    (id: number) => setItems((list) => list.filter((t) => t.id !== id)),
    [],
  );

  const toast = React.useCallback(
    (t: ToastInput) => {
      const id = Date.now() + Math.random();
      setItems((list) => [...list, { id, variant: "default", ...t }]);
      window.setTimeout(() => remove(id), t.duration ?? 3800);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted &&
        createPortal(
          <div
            role="region"
            aria-label="Notifications"
            className="pointer-events-none fixed bottom-5 right-5 z-[80] flex w-[min(360px,90vw)] flex-col gap-2.5"
          >
            <AnimatePresence initial={false}>
              {items.map((t) => {
                const icon = ICON[t.variant];
                return (
                  <motion.div
                    key={t.id}
                    layout
                    role="status"
                    initial={{ opacity: 0, y: 16, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.32, ease: easeOrganic }}
                    className="pointer-events-auto flex items-start gap-3 rounded-[14px] rounded-tl-[18px] border border-line bg-paper p-3.5 shadow-lift"
                  >
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-full",
                        icon.cls,
                      )}
                    >
                      {icon.node}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-bark">{t.title}</p>
                      {t.description && (
                        <p className="mt-0.5 text-xs leading-relaxed text-stone">
                          {t.description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(t.id)}
                      aria-label="Dismiss notification"
                      className="text-stone transition-colors hover:text-bark"
                    >
                      <Close size={15} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "@/components/icons";
import { easeOrganic } from "@/components/motion/motion-tokens";
import { cn } from "@/lib/utils";

/**
 * Keeps the thread pinned to the newest message while a reply streams.
 * If you scroll up to read history it stops following and shows a jump
 * control; returning to the bottom resumes the auto-stick.
 */
export function ChatScrollArea({
  children,
  messagesCount,
  streamTick,
  className,
}: {
  children: React.ReactNode;
  messagesCount: number;
  streamTick: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [stick, setStick] = React.useState(true);
  const [showJump, setShowJump] = React.useState(false);

  const nearBottom = React.useCallback(() => {
    const el = ref.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior) => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior });
  }, []);

  const onScroll = React.useCallback(() => {
    const near = nearBottom();
    setStick(near);
    setShowJump(!near);
  }, [nearBottom]);

  // A new message (you sent one, or a reply began) always jumps to the bottom.
  React.useEffect(() => {
    setStick(true);
    setShowJump(false);
    scrollToBottom("auto");
  }, [messagesCount, scrollToBottom]);

  // Streaming growth only follows if you are already at the bottom.
  React.useEffect(() => {
    if (stick) scrollToBottom("auto");
  }, [streamTick, stick, scrollToBottom]);

  const jump = () => {
    scrollToBottom("smooth");
    setStick(true);
    setShowJump(false);
  };

  return (
    <div className={cn("relative", className)}>
      <div
        ref={ref}
        onScroll={onScroll}
        className="verdant-scroll h-full overflow-y-auto"
      >
        {children}
      </div>
      <AnimatePresence>
        {showJump && (
          <motion.button
            type="button"
            onClick={jump}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2, ease: easeOrganic }}
            className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-medium text-canopy shadow-lift"
          >
            <ChevronDown size={14} />
            Jump to latest
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

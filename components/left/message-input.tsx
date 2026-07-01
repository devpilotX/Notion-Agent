"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, ArrowUp, Mic, Stop } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useSpeechRecognition } from "@/lib/use-voice";
import { useAgentDraft } from "@/components/right/agent-config-context";
import { cn } from "@/lib/utils";

function mmss(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export const MessageInput = React.forwardRef<
  HTMLTextAreaElement,
  {
    value: string;
    onChange: (v: string) => void;
    onSend: (text: string) => void;
    onStop?: () => void;
    streaming?: boolean;
    onAttachClick?: () => void;
    attachCount?: number;
    attachBusy?: boolean;
    disabled?: boolean;
  }
>(function MessageInput(
  {
    value,
    onChange,
    onSend,
    onStop,
    streaming = false,
    onAttachClick,
    attachCount = 0,
    attachBusy = false,
    disabled,
  },
  ref,
) {
  const innerRef = React.useRef<HTMLTextAreaElement>(null);
  React.useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);
  const { draft } = useAgentDraft();
  const name = draft.name || "Fern";

  // Mic appends final transcripts into the field. It never sends.
  const valueRef = React.useRef(value);
  valueRef.current = value;
  const appendTranscript = React.useCallback(
    (t: string) => {
      const base = valueRef.current;
      const next = base.trim().length ? `${base.replace(/\s+$/, "")} ${t}` : t;
      onChange(next);
    },
    [onChange],
  );
  const { supported: micSupported, recording, interim, elapsedMs, maxMs, toggle, stop } =
    useSpeechRecognition(appendTranscript);

  React.useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);

  const send = () => {
    const text = value.trim();
    if (!text || disabled) return;
    if (recording) stop();
    onSend(text);
  };

  return (
    <div className="shrink-0 px-4 pb-5 pt-3">
      {/* Recording bar: timer, live caption, stop. Never sends. */}
      <AnimatePresence>
        {recording && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="mb-2 flex items-center gap-2.5 rounded-[12px] border border-fern/40 bg-fern/5 px-3 py-2"
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fern/60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-fern" />
            </span>
            <span className="font-mono text-xs tabular-nums text-canopy">
              {mmss(elapsedMs)} / {mmss(maxMs)}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-stone">
              {interim || "Listening. Speak freely, it keeps going through pauses."}
            </span>
            <button
              type="button"
              onClick={stop}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2 py-1 text-xs font-medium text-bark transition-colors hover:border-fern hover:text-canopy"
            >
              <Stop size={12} />
              Stop
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          "group flex items-end gap-2 rounded-[18px] rounded-bl-[22px] border border-line bg-paper p-2 pl-3 shadow-soft",
          "transition-shadow duration-300 focus-within:border-fern",
          "focus-within:shadow-[0_0_0_4px_rgb(var(--fern-ring)/0.18)]",
          recording && "border-fern shadow-[0_0_0_4px_rgb(var(--fern-ring)/0.18)]",
        )}
      >
        <Tooltip label={attachBusy ? "Indexing…" : attachCount > 0 ? `${attachCount} attached` : "Attach"}>
          <button
            type="button"
            onClick={onAttachClick}
            aria-label="Attach files or a folder"
            aria-haspopup="menu"
            className="relative grid h-9 w-9 shrink-0 self-end place-items-center rounded-[12px] text-stone transition-colors hover:bg-canopy/10 hover:text-canopy"
          >
            <motion.span
              animate={attachBusy ? { rotate: [0, 12, -12, 0] } : { rotate: 0 }}
              transition={attachBusy ? { duration: 1, repeat: Infinity } : { duration: 0.2 }}
            >
              <Paperclip size={18} />
            </motion.span>
            {attachCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-canopy px-1 text-[10px] font-semibold text-canopy-contrast">
                {attachCount}
              </span>
            )}
          </button>
        </Tooltip>

        <textarea
          ref={innerRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={
            recording
              ? "Recording. Your words appear here."
              : disabled
                ? `${name} is replying…`
                : `Message ${name}…`
          }
          aria-label="Message"
          className="verdant-scroll max-h-[140px] flex-1 resize-none bg-transparent py-2 text-sm text-bark outline-none placeholder:text-stone/70"
        />

        {micSupported && (
          <Tooltip label={recording ? "Stop recording" : "Record voice"}>
            <button
              type="button"
              onClick={toggle}
              aria-label={recording ? "Stop recording" : "Record your voice"}
              aria-pressed={recording}
              className={cn(
                "grid h-9 w-9 shrink-0 self-end place-items-center rounded-[12px] transition-colors",
                recording
                  ? "bg-fern/15 text-fern"
                  : "text-stone hover:bg-canopy/10 hover:text-canopy",
              )}
            >
              {recording ? (
                <Stop size={16} />
              ) : (
                <Mic size={18} />
              )}
            </button>
          </Tooltip>
        )}

        {streaming && onStop ? (
          <Tooltip label="Stop generating">
            <Button
              size="icon"
              aria-label="Stop generating"
              onClick={onStop}
              className="self-end rounded-[14px]"
            >
              <Stop size={16} />
            </Button>
          </Tooltip>
        ) : (
          <Button
            size="icon"
            aria-label="Send message"
            onClick={send}
            disabled={disabled || !value.trim()}
            className="self-end rounded-[14px]"
          >
            <motion.span whileTap={{ y: -2, x: 2 }}>
              <ArrowUp size={18} />
            </motion.span>
          </Button>
        )}
      </div>
      <p className="mt-2 px-1 text-center text-[11px] text-stone/70">
        {name} can make mistakes. Replies use your saved keys.
      </p>
    </div>
  );
});

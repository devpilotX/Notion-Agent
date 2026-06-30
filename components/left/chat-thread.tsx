"use client";

import * as React from "react";
import type { AssistantMessage, ChatMessage, ChatStep } from "@/lib/api/use-run-chat";
import { Leaf, Check, Sprout, Speaker } from "@/components/icons";
import { useSpeech } from "@/lib/use-voice";
import { cn } from "@/lib/utils";

export function ChatThread({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6">
      {messages.map((m) =>
        m.role === "user" ? (
          <div key={m.id} className="flex justify-end">
            <div className="radius-leaf-alt max-w-[85%] whitespace-pre-wrap bg-canopy/10 px-4 py-2.5 text-sm text-bark">
              {m.text}
            </div>
          </div>
        ) : (
          <AssistantBubble key={m.id} message={m} />
        ),
      )}
    </div>
  );
}

function AssistantBubble({ message }: { message: AssistantMessage }) {
  const streaming = message.status === "streaming";
  const { supported: ttsSupported, speak, cancel } = useSpeech();
  const [speaking, setSpeaking] = React.useState(false);
  const text = message.chunks.join("");

  const onSpeak = () => {
    if (speaking) {
      cancel();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(text);
    // Reset the toggle when playback likely finished (rough estimate by length).
    const ms = Math.min(60000, Math.max(2500, text.length * 55));
    window.setTimeout(() => setSpeaking(false), ms);
  };

  return (
    <div className="flex gap-3">
      <div className="radius-leaf mt-0.5 grid h-8 w-8 shrink-0 place-items-center bg-gradient-to-br from-canopy to-fern text-canopy-contrast">
        <Leaf size={16} strokeWidth={1.7} />
      </div>
      <div className="min-w-0 flex-1">
        {message.steps.length > 0 && (
          <StepTrace steps={message.steps} streaming={streaming} />
        )}
        {message.chunks.length > 0 && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-bark">
            {message.chunks.map((c, i) => (
              <span key={i} className="ink-chunk">
                {c}
              </span>
            ))}
            {streaming && (
              <span
                aria-hidden="true"
                className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-fern"
              />
            )}
          </p>
        )}
        {!streaming && ttsSupported && text.length > 0 && (
          <button
            type="button"
            onClick={onSpeak}
            aria-label={speaking ? "Stop playback" : "Play reply aloud"}
            aria-pressed={speaking}
            className={cn(
              "mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs transition-colors",
              speaking ? "border-fern bg-fern/10 text-fern" : "text-stone hover:text-canopy hover:border-moss",
            )}
          >
            <Speaker size={13} />
            {speaking ? "Stop" : "Play"}
          </button>
        )}
        {message.status === "error" && message.error && (
          <p className="mt-2 rounded-[12px] border border-line bg-mist/50 px-3 py-2 text-sm text-stone">
            {message.error}
          </p>
        )}
      </div>
    </div>
  );
}

function StepTrace({
  steps,
  streaming,
}: {
  steps: ChatStep[];
  streaming: boolean;
}) {
  return (
    <ul className="mb-2 flex flex-col gap-1">
      {steps.map((s) => (
        <li key={s.id} className="flex items-center gap-2 text-xs text-stone">
          <span
            className={cn(
              "grid h-4 w-4 place-items-center",
              s.done ? "text-canopy" : "text-moss",
            )}
          >
            {s.done ? (
              <Check size={12} />
            ) : (
              <Sprout size={12} className={streaming ? "animate-pulse" : ""} />
            )}
          </span>
          {s.label}
        </li>
      ))}
    </ul>
  );
}

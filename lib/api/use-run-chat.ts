"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { readRunStream } from "@/lib/streaming-contract";
import { fetchSessionMessages } from "./sessions";
import { api } from "./client";
import type { SessionDTO } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export type ChatStep = { id: string; label: string; done: boolean };

export type UserMessage = { id: string; role: "user"; text: string };
export type AssistantMessage = {
  id: string;
  role: "assistant";
  chunks: string[];
  steps: ChatStep[];
  status: "streaming" | "done" | "error";
  error?: string;
};
export type ChatMessage = UserMessage | AssistantMessage;

const uid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

export function useRunChat(agentId = "default") {
  const qc = useQueryClient();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [status, setStatus] = React.useState<"idle" | "streaming" | "loading">(
    "idle",
  );
  const [sessionId, setSessionIdState] = React.useState<string | null>(null);
  const sessionRef = React.useRef<string | undefined>(undefined);

  const setSessionId = React.useCallback((id: string | null) => {
    sessionRef.current = id ?? undefined;
    setSessionIdState(id);
  }, []);

  const send = React.useCallback(
    async (text: string) => {
      const assistantId = uid();
      const update = (fn: (a: AssistantMessage) => AssistantMessage) =>
        setMessages((list) =>
          list.map((m) =>
            m.id === assistantId && m.role === "assistant" ? fn(m) : m,
          ),
        );

      setMessages((list) => [
        ...list,
        { id: uid(), role: "user", text },
        { id: assistantId, role: "assistant", chunks: [], steps: [], status: "streaming" },
      ]);

      if (!BASE) {
        update((a) => ({
          ...a,
          status: "error",
          error: "The engine is not configured. Set NEXT_PUBLIC_API_URL and start it.",
        }));
        return;
      }

      setStatus("streaming");
      try {
        const res = await fetch(`${BASE}/agents/${agentId}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ message: text, sessionId: sessionRef.current }),
        });
        if (!res.ok || !res.body) throw new Error(`Run failed (${res.status})`);

        for await (const ev of readRunStream(res.body)) {
          switch (ev.type) {
            case "run.start":
              if (ev.sessionId) setSessionId(ev.sessionId);
              break;
            case "step.start":
              update((a) => ({
                ...a,
                steps: [...a.steps, { id: ev.stepId, label: ev.label, done: false }],
              }));
              break;
            case "step.end":
              update((a) => ({
                ...a,
                steps: a.steps.map((s) =>
                  s.id === ev.stepId ? { ...s, done: true } : s,
                ),
              }));
              break;
            case "message.delta":
              update((a) => ({ ...a, chunks: [...a.chunks, ev.text] }));
              break;
            case "error":
              update((a) => ({ ...a, status: "error", error: ev.message }));
              break;
            case "run.done":
              update((a) => (a.status === "error" ? a : { ...a, status: "done" }));
              break;
            default:
              break;
          }
        }
      } catch (err) {
        update((a) => ({
          ...a,
          status: "error",
          error: err instanceof Error ? err.message : "Could not reach the engine.",
        }));
      } finally {
        setStatus("idle");
        update((a) => (a.status === "streaming" ? { ...a, status: "done" } : a));
        qc.invalidateQueries({ queryKey: ["sessions"] });
        qc.invalidateQueries({ queryKey: ["usage"] });
      }
    },
    [agentId, qc, setSessionId],
  );

  const loadSession = React.useCallback(
    async (id: string) => {
      if (!BASE) return;
      setStatus("loading");
      try {
        const rows = await fetchSessionMessages(id);
        const mapped: ChatMessage[] = rows
          .filter((r) => r.role === "user" || r.role === "assistant")
          .map((r) =>
            r.role === "user"
              ? { id: r.id, role: "user", text: r.content }
              : {
                  id: r.id,
                  role: "assistant",
                  chunks: [r.content],
                  steps: [],
                  status: "done",
                },
          );
        setMessages(mapped);
        setSessionId(id);
      } catch {
        /* leave thread as is on failure */
      } finally {
        setStatus("idle");
      }
    },
    [setSessionId],
  );

  const newSession = React.useCallback(async () => {
    setMessages([]);
    setSessionId(null);
    if (!BASE) return;
    try {
      const s = await api.post<SessionDTO>("/sessions");
      setSessionId(s.id);
      qc.invalidateQueries({ queryKey: ["sessions"] });
    } catch {
      /* offline: the thread still clears to the hero */
    }
  }, [qc, setSessionId]);

  /** Add a user message plus an assistant message with no model call. */
  const pushExchange = React.useCallback((userText: string, assistantText: string) => {
    const assistantId = uid();
    setMessages((list) => [
      ...list,
      { id: uid(), role: "user", text: userText },
      { id: assistantId, role: "assistant", chunks: [assistantText], steps: [], status: "done" },
    ]);
    return assistantId;
  }, []);

  /** Replace the text of an assistant message (used after a local action). */
  const setAssistantText = React.useCallback((id: string, text: string) => {
    setMessages((list) =>
      list.map((m) =>
        m.id === id && m.role === "assistant" ? { ...m, chunks: [text] } : m,
      ),
    );
  }, []);

  return {
    messages,
    status,
    sessionId,
    send,
    loadSession,
    newSession,
    pushExchange,
    setAssistantText,
  };
}

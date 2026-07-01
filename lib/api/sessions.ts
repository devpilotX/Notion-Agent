"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { SessionDTO, SessionMessageDTO } from "./types";
import { sessions as sessionFixtures, type Session } from "@/lib/fixtures";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function toDisplay(s: SessionDTO): Session {
  return {
    id: s.id,
    title: s.title || "New session",
    preview:
      s.messageCount > 0
        ? `${s.messageCount} message${s.messageCount === 1 ? "" : "s"}`
        : "Empty",
    when: relativeTime(s.createdAt),
  };
}

/** Sessions from the engine, newest first, falling back to fixtures when offline. */
export function useSessions() {
  const q = useQuery({
    queryKey: ["sessions"],
    queryFn: ({ signal }) => api.get<SessionDTO[]>("/sessions", signal),
  });
  const live = q.isSuccess && Array.isArray(q.data);
  const sessions: Session[] = live
    ? (q.data as SessionDTO[]).map(toDisplay)
    : sessionFixtures;
  return { sessions, isLive: live };
}

export function fetchSessionMessages(id: string) {
  return api.get<SessionMessageDTO[]>(`/sessions/${id}/messages`);
}

export function useRenameSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; title: string }) =>
      api.patch<SessionDTO>(`/sessions/${v.id}`, { title: v.title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ deleted: true }>(`/sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

export type TriggerType = "scheduled" | "webhook" | "email" | "file";

export type TriggerConfig = {
  cron?: string;
  intervalSec?: number;
  path?: string;
  token?: string;
  address?: string;
  message?: string;
};

export type TriggerDTO = {
  id: string;
  type: TriggerType | "manual" | "mention";
  enabled: boolean;
  config: TriggerConfig;
  createdAt: string;
};

export function useTriggers() {
  const q = useQuery({
    queryKey: ["triggers"],
    queryFn: ({ signal }) => api.get<TriggerDTO[]>("/triggers", signal),
  });
  return { triggers: q.data ?? [], isLive: q.isSuccess };
}

export function useCreateTrigger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { type: TriggerType; config: TriggerConfig }) =>
      api.post<TriggerDTO>("/triggers", v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["triggers"] }),
  });
}

export function useUpdateTrigger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; enabled?: boolean; config?: TriggerConfig }) =>
      api.patch<TriggerDTO>(`/triggers/${v.id}`, { enabled: v.enabled, config: v.config }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["triggers"] }),
  });
}

export function useDeleteTrigger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ deleted: true }>(`/triggers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["triggers"] });
      qc.invalidateQueries({ queryKey: ["usage"] });
    },
  });
}

export function useFireTrigger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; message?: string }) =>
      api.post<{ runId: string; reply: string }>(`/triggers/${v.id}/fire`, {
        message: v.message,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usage"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

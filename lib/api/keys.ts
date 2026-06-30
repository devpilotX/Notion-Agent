"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { KeyDTO, Provider } from "./types";
import { apiKeys as keyFixtures } from "@/lib/fixtures";

export type KeyItem = {
  id: string;
  provider: Provider;
  label: string;
  masked: string;
  status: KeyDTO["status"];
};

export type DetectResult = {
  provider: Provider | null;
  status: KeyDTO["status"];
  models: string[];
  usable: boolean;
  message?: string;
};

/** Auto-detect the provider for a pasted secret. */
export function detectKey(secret: string) {
  return api.post<DetectResult>("/keys/detect", { secret });
}

/** Keys from the engine, falling back to fixtures so the card always renders. */
export function useKeys() {
  const q = useQuery({
    queryKey: ["keys"],
    queryFn: ({ signal }) => api.get<KeyDTO[]>("/keys", signal),
  });
  const live = q.isSuccess && Array.isArray(q.data);
  const source = live ? (q.data as KeyDTO[]) : keyFixtures;
  const keys: KeyItem[] = source.map((k) => ({
    id: k.id,
    provider: k.provider,
    label: k.label,
    masked: k.masked,
    status: k.status,
  }));
  return { keys, isLive: live };
}

export function useCreateKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      provider: string;
      label: string;
      secret: string;
      baseUrl?: string;
    }) => api.post<KeyDTO>("/keys", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keys"] }),
  });
}

export function useRotateKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; secret: string }) =>
      api.post<KeyDTO>(`/keys/${v.id}/rotate`, { secret: v.secret }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keys"] }),
  });
}

export function useDeleteKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ deleted: true }>(`/keys/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keys"] }),
  });
}

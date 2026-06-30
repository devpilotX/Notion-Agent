"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { AgentDTO } from "./types";

/** The current agent config from the engine (id, instructions, model, etc.). */
export function useAgentConfig() {
  return useQuery({
    queryKey: ["agent", "current"],
    queryFn: ({ signal }) => api.get<AgentDTO>("/agents/current", signal),
  });
}

type AgentPatch = Partial<
  Pick<AgentDTO, "name" | "instructions" | "modelMode" | "modelId" | "favorite">
>;

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; patch: AgentPatch }) =>
      api.patch<AgentDTO>(`/agents/${v.id}`, v.patch),
    onSuccess: (data) => qc.setQueryData(["agent", "current"], data),
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; favorite: boolean }) =>
      api.patch<AgentDTO>(`/agents/${v.id}`, { favorite: v.favorite }),
    onSuccess: (data) => qc.setQueryData(["agent", "current"], data),
  });
}

export function useDuplicateAgent() {
  return useMutation({
    mutationFn: (id: string) => api.post<AgentDTO>(`/agents/${id}/duplicate`),
  });
}

export function useResetAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<AgentDTO>(`/agents/${id}/reset`),
    onSuccess: (data) => {
      qc.setQueryData(["agent", "current"], data);
      qc.invalidateQueries({ queryKey: ["triggers"] });
    },
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ deleted: true }>(`/agents/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent", "current"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["triggers"] });
      qc.invalidateQueries({ queryKey: ["usage"] });
    },
  });
}

/** Fetch the agent's full config for export/share. */
export function fetchAgentExport(id: string) {
  return api.get<AgentDTO>(`/agents/${id}/export`);
}

/** Ask the model to draft agent instructions from a short description. */
export function useDraftInstructions() {
  return useMutation({
    mutationFn: (v: { id: string; description: string }) =>
      api.post<{ instructions: string }>(`/agents/${v.id}/draft-instructions`, {
        description: v.description,
      }),
  });
}

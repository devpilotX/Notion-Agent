"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

export type McpAuth =
  | { type: "none" }
  | { type: "bearer"; token: string; prefix?: "Bearer" | "Token" }
  | { type: "basic"; username: string; password: string }
  | { type: "apikey"; headerName: string; headerValue: string };

export type McpConfig = {
  name?: string;
  transport?: "stdio" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  auth?: McpAuth;
  headers?: Record<string, string>;
  timeoutMs?: number;
  tools?: string[];
};

export type ConnectionDTO = {
  id: string;
  kind: string;
  status: "connected" | "error" | "disconnected";
  config: McpConfig;
  createdAt: string;
};

export function useConnections() {
  const q = useQuery({
    queryKey: ["connections"],
    queryFn: ({ signal }) => api.get<ConnectionDTO[]>("/connections", signal),
  });
  return { connections: q.data ?? [], isLive: q.isSuccess };
}

export function useCreateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: McpConfig) => api.post<ConnectionDTO>("/connections", config),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  });
}

export function useTestConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<ConnectionDTO>(`/connections/${id}/test`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  });
}

export function useDeleteConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ deleted: true }>(`/connections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections"] }),
  });
}

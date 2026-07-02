"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiConfigured } from "./client";

export type AuthUser = { id: string; email: string; name: string | null };
export type MeResponse = { authRequired: boolean; user: AuthUser | null };

/**
 * Who am I, and does this engine require sign-in at all?
 * When the engine is offline or auth is disabled, the app runs as before.
 */
export function useMe() {
  const q = useQuery({
    queryKey: ["auth", "me"],
    queryFn: ({ signal }) => api.get<MeResponse>("/auth/me", signal),
    enabled: apiConfigured(),
    staleTime: 60_000,
  });
  return {
    authRequired: q.data?.authRequired ?? false,
    user: q.data?.user ?? null,
    isLoading: apiConfigured() && q.isLoading,
    refetch: q.refetch,
  };
}

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { email: string; password: string }) =>
      api.post<{ user: AuthUser }>("/auth/signin", v),
    onSuccess: () => qc.invalidateQueries(), // fresh data for the signed-in user
  });
}

export function useSignUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { email: string; password: string; name?: string }) =>
      api.post<{ user: AuthUser }>("/auth/signup", v),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ok: true }>("/auth/signout"),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useUpdateName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.patch<{ user: AuthUser }>("/auth/me", { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth"] }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (v: { current: string; next: string }) =>
      api.post<{ ok: true }>("/auth/change-password", v),
  });
}

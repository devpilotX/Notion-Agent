"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { UsageDTO } from "./types";

/** Real token/cost usage for the agent, summed from the runs table. */
export function useUsage() {
  const q = useQuery({
    queryKey: ["usage"],
    queryFn: ({ signal }) => api.get<UsageDTO>("/usage", signal),
  });
  return { usage: q.data, isLive: q.isSuccess };
}

export function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

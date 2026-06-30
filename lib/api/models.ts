"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import { modelGroups as modelFixtures, type ModelGroup } from "@/lib/fixtures";

/** Model groups from the engine, falling back to fixtures when the API is down. */
export function useModels() {
  const q = useQuery({
    queryKey: ["models"],
    queryFn: ({ signal }) => api.get<ModelGroup[]>("/models", signal),
  });
  const live = q.isSuccess && Array.isArray(q.data) && q.data.length > 0;
  const groups = live ? (q.data as ModelGroup[]) : modelFixtures;
  return { groups, isLive: live };
}

/** The model Auto resolves to right now, shown in Advanced. */
export function useAutoModel() {
  const q = useQuery({
    queryKey: ["models", "auto"],
    queryFn: ({ signal }) => api.get<{ label: string | null }>("/models/auto", signal),
  });
  return { label: q.data?.label ?? null, isLive: q.isSuccess };
}

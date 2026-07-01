"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export type DocSource = { source: string; chunks: number };
export type IngestResult = { source: string; chunks: number; note?: string };

export function useDocuments() {
  const q = useQuery({
    queryKey: ["documents"],
    queryFn: ({ signal }) => api.get<DocSource[]>("/documents", signal),
  });
  return { documents: q.data ?? [], isLive: q.isSuccess };
}

/** Upload files as multipart form data to the RAG ingest endpoint. */
export function useUploadDocuments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      const fd = new FormData();
      for (const f of files) fd.append("files", f, f.name);
      const res = await fetch(`${BASE}/documents/upload`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        // Surface the engine's message (e.g. "add a Google key for embeddings").
        const body = (await res.json().catch(() => null)) as
          | { message?: string | string[] }
          | null;
        const message = Array.isArray(body?.message)
          ? body.message.join(", ")
          : body?.message;
        throw new Error(message || `Upload failed (${res.status})`);
      }
      return (await res.json()) as IngestResult[];
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (source: string) =>
      api.del<{ deleted: number }>(`/documents/${encodeURIComponent(source)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

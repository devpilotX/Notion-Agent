"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAgentConfig } from "@/lib/api/agent";
import { api } from "@/lib/api/client";
import type { AgentDTO } from "@/lib/api/types";

export type Triggers = { run: boolean; newChat: boolean; mention: boolean };

export type Draft = {
  id: string | null;
  name: string;
  description: string;
  instructions: string;
  model: string;
  triggers: Triggers;
  webAccess: boolean;
  trustedUrls: string[];
  allowAllUrls: boolean;
};

const DEFAULT_DRAFT: Draft = {
  id: null,
  name: "Fern",
  description: "",
  instructions: "",
  model: "auto",
  triggers: { run: true, newChat: true, mention: false },
  webAccess: true,
  trustedUrls: ["docs.agentforge.dev", "api.weather.gov"],
  allowAllUrls: false,
};

type SaveStatus = "idle" | "saving" | "saved" | "offline";

type ContextValue = {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  save: () => void;
  status: SaveStatus;
  dirty: boolean;
};

const AgentConfigContext = React.createContext<ContextValue | null>(null);

function fromDTO(a: AgentDTO): Draft {
  const s = a.settings;
  return {
    id: a.id,
    name: a.name ?? "Fern",
    description: a.description ?? "",
    instructions: a.instructions ?? "",
    model: a.modelMode === "auto" ? "auto" : (a.modelId ?? "auto"),
    triggers: s?.triggers ?? DEFAULT_DRAFT.triggers,
    webAccess: s?.webAccess ?? DEFAULT_DRAFT.webAccess,
    trustedUrls: s?.trustedUrls ?? DEFAULT_DRAFT.trustedUrls,
    allowAllUrls: s?.allowAllUrls ?? DEFAULT_DRAFT.allowAllUrls,
  };
}

function toPayload(d: Draft) {
  return {
    name: d.name,
    description: d.description,
    instructions: d.instructions,
    modelMode: d.model === "auto" ? "auto" : "manual",
    modelId: d.model === "auto" ? null : d.model,
    settings: {
      triggers: d.triggers,
      webAccess: d.webAccess,
      trustedUrls: d.trustedUrls,
      allowAllUrls: d.allowAllUrls,
    },
  };
}

export function AgentConfigProvider({ children }: { children: React.ReactNode }) {
  const query = useAgentConfig();
  const qc = useQueryClient();
  const [draft, setDraft] = React.useState<Draft>(DEFAULT_DRAFT);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState(0);

  // Load server data into the draft on first load, and again whenever the
  // server config changes while the user has no unsaved edits (e.g. after a
  // reset or delete). Never clobber in-progress edits.
  React.useEffect(() => {
    if (query.data && !dirty) {
      setDraft(fromDTO(query.data));
    }
  }, [query.data, dirty]);

  const set = React.useCallback<ContextValue["set"]>((key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }, []);

  const save = React.useCallback(async () => {
    if (!draft.id || saving) return;
    setSaving(true);
    try {
      const updated = await api.post<AgentDTO>(
        `/agents/${draft.id}/save`,
        toPayload(draft),
      );
      qc.setQueryData(["agent", "current"], updated);
      setDraft(fromDTO(updated));
      setDirty(false);
      setSavedAt(Date.now());
    } catch {
      /* keep dirty so the user can retry */
    } finally {
      setSaving(false);
    }
  }, [draft, saving, qc]);

  const status: SaveStatus =
    query.isError || !draft.id
      ? "offline"
      : saving
        ? "saving"
        : !dirty && savedAt > 0
          ? "saved"
          : "idle";

  const value = React.useMemo(
    () => ({ draft, set, save, status, dirty }),
    [draft, set, save, status, dirty],
  );

  return (
    <AgentConfigContext.Provider value={value}>
      {children}
    </AgentConfigContext.Provider>
  );
}

export function useAgentDraft() {
  const ctx = React.useContext(AgentConfigContext);
  if (!ctx) {
    throw new Error("useAgentDraft must be used within AgentConfigProvider");
  }
  return ctx;
}

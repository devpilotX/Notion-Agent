"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { useSessions, useRenameSession, useDeleteSession } from "@/lib/api/sessions";
import { useToast } from "@/components/ui/toast";
import { Pencil, Trash, Check, Close } from "@/components/icons";
import { easeOrganic } from "@/components/motion/motion-tokens";
import { cn } from "@/lib/utils";

const LIMIT = 5;

export function SessionsList({
  activeId,
  onSelect,
  onDeleted,
}: {
  activeId?: string | null;
  onSelect: (id: string) => void;
  onDeleted?: (id: string) => void;
}) {
  const { sessions, isLive } = useSessions();
  const { toast } = useToast();
  const rename = useRenameSession();
  const remove = useDeleteSession();
  const [showAll, setShowAll] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [titleDraft, setTitleDraft] = React.useState("");
  const shown = showAll ? sessions : sessions.slice(0, LIMIT);

  const beginRename = (id: string, current: string) => {
    setEditingId(id);
    setTitleDraft(current);
  };

  const commitRename = async () => {
    const id = editingId;
    const title = titleDraft.trim();
    setEditingId(null);
    if (!id || !title) return;
    try {
      await rename.mutateAsync({ id, title });
    } catch {
      toast({ title: "Could not rename session", variant: "danger" });
    }
  };

  const onDelete = async (id: string, title: string) => {
    try {
      await remove.mutateAsync(id);
      toast({ title: "Session deleted", description: title, variant: "danger" });
      onDeleted?.(id);
    } catch {
      toast({ title: "Could not delete session", variant: "danger" });
    }
  };

  return (
    <section aria-label="Recent sessions" className="px-3">
      {sessions.length === 0 && (
        <p className="px-3 py-2 text-xs text-stone">No sessions yet.</p>
      )}
      <StaggerGroup className="flex flex-col gap-0.5">
        {shown.map((s) => {
          const active = activeId ? activeId === s.id : Boolean(s.active);
          const editing = editingId === s.id;
          return (
            <StaggerItem key={s.id}>
              <motion.div
                whileHover={{ y: -1 }}
                transition={{ duration: 0.2, ease: easeOrganic }}
                className={cn(
                  "group relative w-full rounded-[12px] transition-colors",
                  active ? "bg-canopy/10" : "hover:bg-canopy/5",
                )}
              >
                {editing ? (
                  <div className="flex items-center gap-1 px-3 py-2">
                    <input
                      autoFocus
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void commitRename();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      aria-label="Session title"
                      className="min-w-0 flex-1 rounded-[8px] border border-line bg-paper px-2 py-1 text-sm text-bark outline-none focus:border-fern"
                    />
                    <button
                      type="button"
                      onClick={() => void commitRename()}
                      aria-label="Save title"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-[8px] text-canopy hover:bg-canopy/10"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancel rename"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-[8px] text-stone hover:bg-canopy/10"
                    >
                      <Close size={13} />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onSelect(s.id)}
                      aria-current={active ? "true" : undefined}
                      className="w-full px-3 py-2.5 text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-bark">
                          {s.title}
                        </span>
                        <span className="shrink-0 text-[11px] text-stone group-hover:opacity-0">
                          {s.when}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-stone">{s.preview}</p>
                    </button>
                    {isLive && (
                      <div className="absolute right-2 top-2 hidden items-center gap-0.5 group-hover:flex">
                        <button
                          type="button"
                          onClick={() => beginRename(s.id, s.title)}
                          aria-label={`Rename ${s.title}`}
                          className="grid h-6 w-6 place-items-center rounded-[8px] bg-paper/80 text-stone transition-colors hover:text-canopy"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDelete(s.id, s.title)}
                          aria-label={`Delete ${s.title}`}
                          className="grid h-6 w-6 place-items-center rounded-[8px] bg-paper/80 text-stone transition-colors hover:text-danger"
                        >
                          <Trash size={13} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </StaggerItem>
          );
        })}
      </StaggerGroup>
      {sessions.length > LIMIT && (
        <div className="px-1 pt-1">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="rounded-[10px] px-2 py-1.5 text-xs font-medium text-canopy transition-colors hover:underline"
          >
            {showAll ? "Show less" : `Show all (${sessions.length})`}
          </button>
        </div>
      )}
    </section>
  );
}

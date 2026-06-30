"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  ChevronLeft,
  Sliders,
  Share,
  Star,
  More,
  Plus,
  Rotate,
  Trash,
  Seed,
  Sun,
  Moon,
} from "@/components/icons";
import { useUsage, formatTokens } from "@/lib/api/usage";
import {
  useAgentConfig,
  useToggleFavorite,
  useDuplicateAgent,
  useResetAgent,
  useDeleteAgent,
  fetchAgentExport,
} from "@/lib/api/agent";
import { useTheme } from "@/components/theme/theme-provider";
import { useEngineOnline } from "@/lib/api/health";
import { useAgentDraft } from "./agent-config-context";

const ENGINE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export function SettingsTopbar({ onCollapse }: { onCollapse?: () => void }) {
  const { toast } = useToast();
  const { save, status, dirty } = useAgentDraft();
  const { usage, isLive } = useUsage();
  const { data: agent } = useAgentConfig();
  const favorite = useToggleFavorite();
  const duplicate = useDuplicateAgent();
  const reset = useResetAgent();
  const remove = useDeleteAgent();
  const { theme, setTheme } = useTheme();
  const online = useEngineOnline();

  const [shareOpen, setShareOpen] = React.useState(false);
  const [shareText, setShareText] = React.useState("");
  const [prefsOpen, setPrefsOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const isFavorite = Boolean(agent?.favorite);

  const usageText =
    isLive && usage
      ? `${formatTokens(usage.tokens)} tokens${usage.cost > 0 ? ` · $${usage.cost.toFixed(2)}` : ""}`
      : "usage offline";

  const onShare = async () => {
    if (!agent?.id) return;
    try {
      const full = await fetchAgentExport(agent.id);
      setShareText(JSON.stringify(full, null, 2));
      setShareOpen(true);
    } catch {
      toast({ title: "Could not export agent", variant: "danger" });
    }
  };

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast({ title: "Config copied", description: "Agent config is on your clipboard." });
    } catch {
      toast({ title: "Copy failed", variant: "danger" });
    }
  };

  const onFavorite = () => {
    if (!agent?.id) return;
    favorite.mutate(
      { id: agent.id, favorite: !isFavorite },
      {
        onSuccess: (d) =>
          toast({ title: d.favorite ? "Added to favorites" : "Removed from favorites" }),
        onError: () => toast({ title: "Could not update favorite", variant: "danger" }),
      },
    );
  };

  const onDuplicate = () => {
    if (!agent?.id) return;
    duplicate.mutate(agent.id, {
      onSuccess: (d) => toast({ title: "Agent duplicated", description: d.name }),
      onError: () => toast({ title: "Could not duplicate", variant: "danger" }),
    });
  };

  const onReset = () => {
    if (!agent?.id) return;
    reset.mutate(agent.id, {
      onSuccess: () => toast({ title: "Reset to defaults" }),
      onError: () => toast({ title: "Could not reset", variant: "danger" }),
    });
  };

  const onDelete = () => {
    if (!agent?.id) return;
    remove.mutate(agent.id, {
      onSuccess: () => {
        toast({ title: "Agent deleted", variant: "danger" });
        setConfirmDelete(false);
      },
      onError: () => toast({ title: "Could not delete", variant: "danger" }),
    });
  };

  const moreItems: MenuItem[] = [
    { id: "duplicate", label: "Duplicate agent", icon: <Plus size={16} />, onSelect: onDuplicate },
    { id: "reset", label: "Reset to defaults", icon: <Rotate size={16} />, onSelect: onReset },
    {
      id: "delete",
      label: "Delete agent",
      icon: <Trash size={16} />,
      danger: true,
      onSelect: () => setConfirmDelete(true),
    },
  ];

  const statusText = !online
    ? "Engine offline"
    : status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved"
        : dirty
          ? "Unsaved changes"
          : "";

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-mist/80 px-4 py-3 backdrop-blur-md">
      <div className="flex items-center gap-1.5">
        <Tooltip label="Collapse" side="bottom">
          <IconButton aria-label="Collapse settings panel" onClick={onCollapse}>
            <ChevronLeft size={18} />
          </IconButton>
        </Tooltip>
        <h2 className="font-serif text-lg text-bark">Settings</h2>
      </div>

      <div className="flex items-center gap-1">
        <span
          title="Total tokens used by this agent"
          className="mr-1 hidden items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-xs text-stone sm:inline-flex"
        >
          <Seed size={13} className="text-moss" />
          {usageText}
        </span>
        <Tooltip label="Preferences" side="bottom">
          <IconButton aria-label="Preferences" onClick={() => setPrefsOpen(true)}>
            <Sliders size={18} />
          </IconButton>
        </Tooltip>
        <Tooltip label="Share" side="bottom">
          <IconButton aria-label="Share agent" onClick={onShare}>
            <Share size={18} />
          </IconButton>
        </Tooltip>
        <Tooltip label={isFavorite ? "Unfavorite" : "Favorite"} side="bottom">
          <IconButton
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={isFavorite}
            onClick={onFavorite}
            className={isFavorite ? "text-sun" : undefined}
          >
            <Star size={18} />
          </IconButton>
        </Tooltip>
        <Tooltip label="More actions" side="bottom">
          <Menu ariaLabel="More actions" items={moreItems}>
            <More size={18} />
          </Menu>
        </Tooltip>

        {statusText && (
          <span
            className="ml-1 hidden text-xs text-stone sm:inline"
            title={!online ? "The engine is unreachable, so changes will not save." : undefined}
          >
            {statusText}
          </span>
        )}
        <Button
          size="sm"
          className="ml-1"
          onClick={save}
          disabled={status === "saving" || !online}
        >
          {status === "saving" ? "Saving…" : "Save"}
        </Button>
      </div>

      {/* Share / export config */}
      <Modal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share agent"
        description="Copy this config to recreate the agent elsewhere."
        footer={
          <>
            <Button variant="ghost" onClick={() => setShareOpen(false)}>
              Close
            </Button>
            <Button onClick={copyShare}>Copy config</Button>
          </>
        }
      >
        <pre className="verdant-scroll max-h-72 overflow-auto rounded-[12px] border border-line bg-mist/50 p-3 text-xs leading-relaxed text-bark">
          {shareText}
        </pre>
      </Modal>

      {/* Preferences */}
      <Modal
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        title="Preferences"
        description="App settings for this device."
        footer={<Button onClick={() => setPrefsOpen(false)}>Done</Button>}
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-bark">Theme</p>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "primary" : "outline"}
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setTheme("light")}
              >
                <Sun size={16} /> Light
              </Button>
              <Button
                variant={theme === "dark" ? "primary" : "outline"}
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => setTheme("dark")}
              >
                <Moon size={16} /> Dark
              </Button>
            </div>
          </div>
          <div className="rounded-[12px] border border-line bg-mist/40 px-3 py-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-stone">Engine</span>
              <span className="font-mono text-xs text-bark">{ENGINE_URL || "not set"}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-stone">Status</span>
              <span className={online ? "text-fern" : "text-stone"}>
                {online ? "online" : "offline"}
              </span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirm delete */}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete agent?"
        description="This removes the agent and its sessions, runs, and triggers. A fresh default agent is created next time."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onDelete} disabled={remove.isPending}>
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-stone">This cannot be undone.</p>
      </Modal>
    </div>
  );
}

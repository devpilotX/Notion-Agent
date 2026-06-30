"use client";

import * as React from "react";
import { SectionCard, SettingRow } from "./section-card";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip } from "@/components/ui/tooltip";
import { StatusChip } from "@/components/ui/status-chip";
import { useToast } from "@/components/ui/toast";
import { Globe, Link, Plus, Trash, Rotate } from "@/components/icons";
import { useAgentDraft } from "./agent-config-context";
import { AddConnectionModal } from "./add-connection-modal";
import {
  useConnections,
  useCreateConnection,
  useTestConnection,
  useDeleteConnection,
  type ConnectionDTO,
  type McpConfig,
} from "@/lib/api/connections";

// MCP status maps onto the existing status chip vocabulary.
function chipStatus(s: ConnectionDTO["status"]) {
  if (s === "connected") return "working" as const;
  if (s === "error") return "invalid" as const;
  return "unknown" as const;
}

export function ToolsSection({ delay = 0 }: { delay?: number }) {
  const { draft, set } = useAgentDraft();
  const { toast } = useToast();
  const { connections, isLive } = useConnections();
  const createConn = useCreateConnection();
  const testConn = useTestConnection();
  const deleteConn = useDeleteConnection();
  const [open, setOpen] = React.useState(false);

  const onCreate = async (config: McpConfig) => {
    const created = await createConn.mutateAsync(config);
    if (created.status === "connected") {
      toast({
        title: "Connected",
        description: `${created.config.tools?.length ?? 0} tools found`,
        variant: "success",
      });
    } else {
      toast({ title: "Connection failed", description: "Check the details and try again.", variant: "danger" });
    }
    return created;
  };

  return (
    <SectionCard
      icon={<Globe size={18} />}
      title="Tools & access"
      subtitle="What can the agent use?"
      delay={delay}
    >
      <SettingRow
        icon={<Globe size={16} />}
        label="Web access"
        hint="Browse and fetch public pages"
        control={
          <Toggle
            checked={draft.webAccess}
            onCheckedChange={(v) => set("webAccess", v)}
            label="Web access"
          />
        }
      />

      <div className="border-b border-line/70 py-3">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-bark">
          <Link size={16} className="text-moss" />
          Connections
        </p>
        {!isLive || connections.length === 0 ? (
          <p className="text-xs text-stone">
            No connections yet. Add an MCP server to give the agent outside tools.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {connections.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-[12px] border border-line bg-mist/40 px-3 py-2.5"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-line bg-paper text-moss">
                  <Link size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-bark">
                    {c.config.name || c.config.command || c.config.url || "MCP server"}
                  </p>
                  <p className="truncate text-xs text-stone">
                    {(c.config.tools?.length ?? 0) > 0
                      ? `${c.config.tools!.length} tools: ${c.config.tools!.slice(0, 4).join(", ")}`
                      : "no tools"}
                  </p>
                </div>
                <StatusChip status={chipStatus(c.status)} className="hidden sm:inline-flex" />
                <Tooltip label="Reconnect">
                  <IconButton aria-label="Reconnect" onClick={() => testConn.mutate(c.id)}>
                    <Rotate size={16} />
                  </IconButton>
                </Tooltip>
                <Tooltip label="Remove">
                  <IconButton danger aria-label="Remove connection" onClick={() => deleteConn.mutate(c.id)}>
                    <Trash size={16} />
                  </IconButton>
                </Tooltip>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => setOpen(true)}>
        <Plus size={16} />
        Add connection
      </Button>

      <AddConnectionModal
        open={open}
        onClose={() => setOpen(false)}
        onCreate={onCreate}
        isPending={createConn.isPending}
      />
    </SectionCard>
  );
}

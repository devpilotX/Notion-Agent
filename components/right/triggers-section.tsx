"use client";

import * as React from "react";
import { SectionCard, SettingRow } from "./section-card";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select, type SelectGroup } from "@/components/ui/select";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { Play, Chat, At, Plus, Rotate, Link, Paperclip, Trash, Share } from "@/components/icons";
import { useAgentDraft, type Triggers } from "./agent-config-context";
import {
  useTriggers,
  useCreateTrigger,
  useDeleteTrigger,
  useUpdateTrigger,
  useFireTrigger,
  type TriggerType,
  type TriggerDTO,
} from "@/lib/api/triggers";

const ROWS: {
  key: keyof Triggers;
  label: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  { key: "run", label: "Run agent", hint: "Manual run from the composer", icon: <Play size={16} /> },
  { key: "newChat", label: "New chat", hint: "Start fresh on demand", icon: <Chat size={16} /> },
  { key: "mention", label: "When mentioned", hint: "Replies when @Fern appears", icon: <At size={16} /> },
];

const TYPE_GROUP: SelectGroup[] = [
  {
    provider: "Trigger type",
    options: [
      { id: "scheduled", label: "Scheduled" },
      { id: "webhook", label: "Webhook" },
      { id: "email", label: "Email" },
      { id: "file", label: "File watch" },
    ],
  },
];

function typeIcon(type: string) {
  switch (type) {
    case "scheduled":
      return <Rotate size={16} />;
    case "webhook":
      return <Link size={16} />;
    case "email":
      return <At size={16} />;
    case "file":
      return <Paperclip size={16} />;
    default:
      return <Play size={16} />;
  }
}

function summarize(t: TriggerDTO): string {
  const c = t.config ?? {};
  if (t.type === "scheduled")
    return c.cron ? `cron: ${c.cron}` : c.intervalSec ? `every ${c.intervalSec}s` : "no schedule";
  if (t.type === "webhook") return c.token ? `token …${c.token.slice(-6)}` : "webhook";
  if (t.type === "email") return c.address ?? "email";
  if (t.type === "file") return c.path ?? "file";
  return t.type;
}

export function TriggersSection({ delay = 0 }: { delay?: number }) {
  const { draft, set } = useAgentDraft();
  const { toast } = useToast();
  const { triggers, isLive } = useTriggers();
  const createTrigger = useCreateTrigger();
  const deleteTrigger = useDeleteTrigger();
  const updateTrigger = useUpdateTrigger();
  const fireTrigger = useFireTrigger();

  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<TriggerType>("scheduled");
  const [intervalSec, setIntervalSec] = React.useState("60");
  const [cron, setCron] = React.useState("");
  const [path, setPath] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [message, setMessage] = React.useState("");

  const reset = () => {
    setOpen(false);
    setType("scheduled");
    setIntervalSec("60");
    setCron("");
    setPath("");
    setAddress("");
    setMessage("");
  };

  const submit = async () => {
    const config: Record<string, unknown> = {};
    if (message.trim()) config.message = message.trim();
    if (type === "scheduled") {
      if (cron.trim()) config.cron = cron.trim();
      else config.intervalSec = Math.max(1, parseInt(intervalSec, 10) || 60);
    }
    if (type === "file") config.path = path.trim();
    if (type === "email") config.address = address.trim();
    try {
      await createTrigger.mutateAsync({ type, config });
      toast({ title: "Trigger added", variant: "success" });
      reset();
    } catch {
      toast({ title: "Could not add trigger", description: "Is the engine running?", variant: "danger" });
    }
  };

  const onFire = async (t: TriggerDTO) => {
    try {
      await fireTrigger.mutateAsync({ id: t.id });
      toast({ title: "Trigger fired", description: "A run was started." });
    } catch {
      toast({ title: "Could not fire trigger", variant: "danger" });
    }
  };

  const onDelete = async (t: TriggerDTO) => {
    try {
      await deleteTrigger.mutateAsync(t.id);
      toast({ title: "Trigger removed", variant: "danger" });
    } catch {
      toast({ title: "Could not remove trigger", variant: "danger" });
    }
  };

  const onCopyWebhook = async (t: TriggerDTO) => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "";
    if (!t.config.token || !base) return;
    try {
      await navigator.clipboard.writeText(`${base}/triggers/webhook/${t.config.token}`);
      toast({
        title: "Webhook URL copied",
        description: "POST to it with an optional { message } body.",
        variant: "success",
      });
    } catch {
      toast({ title: "Copy failed", variant: "danger" });
    }
  };

  return (
    <SectionCard
      icon={<Play size={18} />}
      title="Triggers"
      subtitle="When should this agent run?"
      delay={delay}
    >
      <div className="flex flex-col">
        {ROWS.map((r, i) => (
          <SettingRow
            key={r.key}
            icon={r.icon}
            label={r.label}
            hint={r.hint}
            last={i === ROWS.length - 1}
            control={
              <Toggle
                checked={draft.triggers[r.key]}
                onCheckedChange={(v) => set("triggers", { ...draft.triggers, [r.key]: v })}
                label={r.label}
              />
            }
          />
        ))}
      </div>

      {isLive && triggers.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {triggers.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-[12px] border border-line bg-mist/40 px-3 py-2.5"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-line bg-paper text-moss">
                {typeIcon(t.type)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium capitalize text-bark">{t.type}</p>
                <p className="truncate text-xs text-stone">{summarize(t)}</p>
              </div>
              <Toggle
                checked={t.enabled}
                onCheckedChange={(v) => updateTrigger.mutate({ id: t.id, enabled: v })}
                label={`Enable ${t.type} trigger`}
              />
              {t.type === "webhook" && t.config.token && (
                <Tooltip label="Copy webhook URL">
                  <IconButton aria-label="Copy webhook URL" onClick={() => onCopyWebhook(t)}>
                    <Share size={16} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip label="Run now">
                <IconButton aria-label="Run trigger now" onClick={() => onFire(t)}>
                  <Play size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip label="Delete">
                <IconButton danger aria-label="Delete trigger" onClick={() => onDelete(t)}>
                  <Trash size={16} />
                </IconButton>
              </Tooltip>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => setOpen(true)}>
        <Plus size={16} />
        Add trigger
      </Button>

      <Modal
        open={open}
        onClose={reset}
        title="Add a trigger"
        description="Triggers start a run on a schedule or an external event."
        footer={
          <>
            <Button variant="ghost" onClick={reset}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={createTrigger.isPending}>
              {createTrigger.isPending ? "Adding…" : "Add trigger"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-bark">Type</label>
            <Select
              groups={TYPE_GROUP}
              value={type}
              onChange={(v) => setType(v as TriggerType)}
              ariaLabel="Trigger type"
            />
          </div>

          {type === "scheduled" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-bark">Every (seconds)</label>
                <Input
                  type="number"
                  min={1}
                  value={intervalSec}
                  onChange={(e) => setIntervalSec(e.target.value)}
                  placeholder="60"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-bark">Or cron</label>
                <Input
                  value={cron}
                  onChange={(e) => setCron(e.target.value)}
                  placeholder="*/5 * * * *"
                />
              </div>
            </div>
          )}

          {type === "file" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-bark">Watch path</label>
              <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="C:\\path\\to\\file.txt" />
            </div>
          )}

          {type === "email" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-bark">Address</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="agent@inbox.dev" />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-bark">Run message</label>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What should the agent do when this fires?"
            />
          </div>
          {type === "webhook" && (
            <p className="text-xs text-stone">
              A secret URL token is generated when you add the webhook.
            </p>
          )}
        </div>
      </Modal>
    </SectionCard>
  );
}

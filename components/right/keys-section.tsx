"use client";

import * as React from "react";
import { SectionCard } from "./section-card";
import { StatusChip } from "@/components/ui/status-chip";
import { Tooltip } from "@/components/ui/tooltip";
import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select, type SelectGroup } from "@/components/ui/select";
import { ProviderMark, Rotate, Trash, Plus, Seed } from "@/components/icons";
import {
  useKeys,
  useCreateKey,
  useRotateKey,
  useDeleteKey,
  detectKey,
} from "@/lib/api/keys";
import { useToast } from "@/components/ui/toast";

const PROVIDER_GROUP: SelectGroup[] = [
  {
    provider: "Detect",
    options: [{ id: "auto", label: "Auto-detect from key" }],
  },
  {
    provider: "Provider",
    options: [
      { id: "anthropic", label: "Anthropic" },
      { id: "openai", label: "OpenAI" },
      { id: "google", label: "Google" },
      { id: "groq", label: "Groq" },
      { id: "mistral", label: "Mistral" },
      { id: "openrouter", label: "OpenRouter" },
      { id: "xai", label: "xAI Grok" },
      { id: "deepseek", label: "DeepSeek" },
      { id: "cohere", label: "Cohere" },
      { id: "together", label: "Together AI" },
    ],
  },
];

export function KeysSection({ delay = 0 }: { delay?: number }) {
  const { toast } = useToast();
  const { keys } = useKeys();
  const createKey = useCreateKey();
  const rotateKey = useRotateKey();
  const deleteKey = useDeleteKey();

  const [addOpen, setAddOpen] = React.useState(false);
  const [provider, setProvider] = React.useState("auto");
  const [label, setLabel] = React.useState("");
  const [secret, setSecret] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const [rotateId, setRotateId] = React.useState<string | null>(null);
  const [rotateSecret, setRotateSecret] = React.useState("");

  const resetAdd = () => {
    setAddOpen(false);
    setLabel("");
    setSecret("");
    setProvider("auto");
    setBusy(false);
  };

  const submitAdd = async () => {
    const sec = secret.trim();
    setBusy(true);
    try {
      let chosen = provider;
      if (provider === "auto") {
        const det = await detectKey(sec);
        if (!det.usable || !det.provider) {
          toast({
            title: "Key not usable",
            description: det.message ?? "Could not detect a provider for this key.",
            variant: "danger",
          });
          return;
        }
        chosen = det.provider;
        toast({
          title: `Detected ${det.provider}`,
          description: `${det.models.length} models available`,
        });
      }
      await createKey.mutateAsync({
        provider: chosen,
        label: label.trim() || `${chosen} key`,
        secret: sec,
      });
      toast({ title: "Key added", variant: "success" });
      resetAdd();
    } catch {
      toast({
        title: "Could not add key",
        description: "Check that the engine is running.",
        variant: "danger",
      });
    } finally {
      setBusy(false);
    }
  };

  const submitRotate = async () => {
    if (!rotateId) return;
    try {
      await rotateKey.mutateAsync({ id: rotateId, secret: rotateSecret.trim() });
      toast({ title: "Key rotated", variant: "success" });
      setRotateId(null);
      setRotateSecret("");
    } catch {
      toast({ title: "Could not rotate key", variant: "danger" });
    }
  };

  const onDelete = async (id: string, lbl: string) => {
    try {
      await deleteKey.mutateAsync(id);
      toast({ title: "Key removed", description: lbl, variant: "danger" });
    } catch {
      toast({ title: "Could not remove key", variant: "danger" });
    }
  };

  return (
    <SectionCard
      icon={<Seed size={18} />}
      title="Keys"
      subtitle="Provider keys this agent can use"
      delay={delay}
      alt
      action={
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setAddOpen(true)}
        >
          <Plus size={16} />
          Add key
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        {keys.length === 0 && (
          <p className="py-2 text-sm text-stone">
            No keys yet. Add one to get started.
          </p>
        )}
        {keys.map((k) => (
          <div
            key={k.id}
            className="flex items-center gap-3 rounded-[12px] border border-line bg-mist/40 px-3 py-2.5"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-line bg-paper text-bark">
              <ProviderMark provider={k.provider} size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-bark">{k.label}</p>
              <p className="truncate font-mono text-xs text-stone">{k.masked}</p>
            </div>
            <StatusChip status={k.status} className="hidden sm:inline-flex" />
            <div className="flex items-center gap-0.5">
              <Tooltip label="Rotate">
                <IconButton
                  aria-label={`Rotate ${k.label}`}
                  onClick={() => setRotateId(k.id)}
                >
                  <Rotate size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip label="Delete">
                <IconButton
                  danger
                  aria-label={`Delete ${k.label}`}
                  onClick={() => onDelete(k.id, k.label)}
                >
                  <Trash size={16} />
                </IconButton>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={addOpen}
        onClose={resetAdd}
        title="Add a key"
        description="Your secret is encrypted before it is stored."
        footer={
          <>
            <Button variant="ghost" onClick={resetAdd}>
              Cancel
            </Button>
            <Button
              onClick={submitAdd}
              disabled={busy || createKey.isPending || secret.trim().length < 8}
            >
              {busy ? "Checking…" : "Add key"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-bark">
              Provider
            </label>
            <Select
              groups={PROVIDER_GROUP}
              value={provider}
              onChange={setProvider}
              ariaLabel="Provider"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-bark">
              Label
            </label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Anthropic, primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-bark">
              Secret
            </label>
            <Input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Paste the API key"
            />
            {provider === "auto" && (
              <p className="mt-1.5 text-xs text-stone">
                Paste any provider key. The provider is detected and confirmed by
                listing its models. A Kiro key is not a model key.
              </p>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={rotateId !== null}
        onClose={() => setRotateId(null)}
        title="Rotate key"
        description="Replace the stored secret with a new one."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRotateId(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitRotate}
              disabled={rotateKey.isPending || rotateSecret.trim().length < 8}
            >
              {rotateKey.isPending ? "Checking…" : "Rotate"}
            </Button>
          </>
        }
      >
        <div>
          <label className="mb-1.5 block text-sm font-medium text-bark">
            New secret
          </label>
          <Input
            type="password"
            value={rotateSecret}
            onChange={(e) => setRotateSecret(e.target.value)}
            placeholder="Paste the new API key"
          />
        </div>
      </Modal>
    </SectionCard>
  );
}

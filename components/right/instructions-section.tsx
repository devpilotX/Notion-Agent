"use client";

import * as React from "react";
import { SectionCard } from "./section-card";
import { Textarea, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Fern, Sprout } from "@/components/icons";
import { useToast } from "@/components/ui/toast";
import { useAgentDraft } from "./agent-config-context";
import { useDraftInstructions } from "@/lib/api/agent";

export function InstructionsSection({ delay = 0 }: { delay?: number }) {
  const { draft, set } = useAgentDraft();
  const { toast } = useToast();
  const draftMutation = useDraftInstructions();
  const [description, setDescription] = React.useState("");

  const onDraft = async () => {
    const desc = description.trim();
    if (!desc || !draft.id) return;
    try {
      const { instructions } = await draftMutation.mutateAsync({ id: draft.id, description: desc });
      set("instructions", instructions);
      toast({ title: "Instructions drafted", description: "Review, then Save to apply." });
    } catch {
      toast({
        title: "Could not draft instructions",
        description: "Check a provider key is working.",
        variant: "danger",
      });
    }
  };

  return (
    <SectionCard
      icon={<Fern size={18} />}
      title="Instructions"
      subtitle="What should the agent do every time it runs?"
      delay={delay}
      alt
    >
      <div className="mb-3 rounded-[12px] border border-line bg-mist/40 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-bark">
          <Sprout size={14} className="text-moss" />
          Describe the agent and let it write its own instructions
        </p>
        <div className="flex gap-2">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. a careful research assistant that always cites sources"
            aria-label="Agent description"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onDraft();
              }
            }}
          />
          <Button
            variant="outline"
            className="shrink-0"
            onClick={onDraft}
            disabled={draftMutation.isPending || description.trim().length < 3 || !draft.id}
          >
            {draftMutation.isPending ? "Drafting…" : "Draft"}
          </Button>
        </div>
      </div>

      <Textarea
        value={draft.instructions}
        onChange={(e) => set("instructions", e.target.value)}
        rows={5}
        aria-label="Agent instructions"
      />
      <p className="mt-2.5 flex items-center gap-1.5 text-xs text-stone">
        Drafted text lands here. Edit if you like, then Save to apply.
      </p>
    </SectionCard>
  );
}

"use client";

import * as React from "react";
import { SectionCard, SettingRow } from "./section-card";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sliders, Plus, Close, Link } from "@/components/icons";
import { useModels, useAutoModel } from "@/lib/api/models";
import { useAgentDraft } from "./agent-config-context";

export function AdvancedSection({ delay = 0 }: { delay?: number }) {
  const { groups } = useModels();
  const { label: autoLabel } = useAutoModel();
  const { draft, set } = useAgentDraft();
  const [urlDraft, setUrlDraft] = React.useState("");

  const addUrl = () => {
    const v = urlDraft.trim();
    if (!v || draft.trustedUrls.includes(v)) return;
    set("trustedUrls", [...draft.trustedUrls, v]);
    setUrlDraft("");
  };

  return (
    <SectionCard
      icon={<Sliders size={18} />}
      title="Advanced"
      subtitle="Model and access controls"
      delay={delay}
    >
      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-bark">
            Model
          </label>
          <Select
            groups={groups}
            value={draft.model}
            onChange={(v) => set("model", v)}
            ariaLabel="Model"
          />
          {draft.model === "auto" && (
            <p className="mt-1.5 text-xs text-stone">
              {autoLabel
                ? `Auto uses ${autoLabel}. It prefers free, then the lowest-cost model.`
                : "Auto picks a free model when available, otherwise the lowest-cost one."}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-bark">
            Trusted URLs
          </label>
          <div className="mb-2 flex flex-wrap gap-2">
            {draft.trustedUrls.map((u) => (
              <span
                key={u}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-mist/50 py-1 pl-2.5 pr-1.5 text-xs text-bark"
              >
                <Link size={13} className="text-moss" />
                {u}
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "trustedUrls",
                      draft.trustedUrls.filter((x) => x !== u),
                    )
                  }
                  aria-label={`Remove ${u}`}
                  className="grid h-4 w-4 place-items-center rounded-full text-stone transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <Close size={11} />
                </button>
              </span>
            ))}
            {draft.trustedUrls.length === 0 && (
              <span className="text-xs text-stone">No trusted URLs yet.</span>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addUrl();
            }}
            className="flex gap-2"
          >
            <Input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="example.com"
              aria-label="Add a trusted URL"
            />
            <Button type="submit" variant="outline" className="shrink-0 gap-1.5">
              <Plus size={16} />
              Add
            </Button>
          </form>
        </div>

        <SettingRow
          label="Allow every URL"
          hint="Let the agent visit any site. Use with care."
          last
          control={
            <Toggle
              checked={draft.allowAllUrls}
              onCheckedChange={(v) => set("allowAllUrls", v)}
              label="Allow every URL"
            />
          }
        />
      </div>
    </SectionCard>
  );
}

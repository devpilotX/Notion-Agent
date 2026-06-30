"use client";

import { Reveal } from "@/components/motion/reveal";
import { Chip } from "@/components/ui/chip";
import { Leaf } from "@/components/icons";
import { starterChips } from "@/lib/fixtures";
import { useAgentDraft } from "@/components/right/agent-config-context";
import { useAgentConfig } from "@/lib/api/agent";

export function ChatHero({ onSend }: { onSend: (text: string) => void }) {
  const { draft } = useAgentDraft();
  const { data: agent } = useAgentConfig();
  const name = draft.name || "Fern";
  const greeting =
    agent?.greeting || "Good morning. It's quiet here. What do you want to work on?";

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 text-center">
      <Reveal delay={0.05}>
        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute -inset-3 rounded-full bg-fern/10 blur-2xl"
          />
          <div className="radius-leaf relative grid h-[76px] w-[76px] place-items-center bg-gradient-to-br from-canopy to-fern text-canopy-contrast shadow-lift">
            <Leaf size={34} strokeWidth={1.6} />
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <h2 className="mt-5 font-serif text-4xl leading-tight text-bark">{name}</h2>
      </Reveal>

      <Reveal delay={0.18}>
        <p className="mt-2 text-base leading-relaxed text-stone">{greeting}</p>
      </Reveal>

      <Reveal delay={0.26} className="mt-6 w-full">
        <div className="flex flex-col gap-2.5">
          {starterChips.map((c) => (
            <Chip key={c} onClick={() => onSend(c)} className="w-full">
              {c}
            </Chip>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

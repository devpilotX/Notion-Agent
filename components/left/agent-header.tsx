"use client";

import { agent } from "@/lib/fixtures";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { StatusDot } from "@/components/ui/status-dot";
import { Leaf } from "@/components/icons";
import { useAgentDraft } from "@/components/right/agent-config-context";
import { useEngineOnline } from "@/lib/api/health";

export function AgentHeader() {
  const { draft, set } = useAgentDraft();
  const online = useEngineOnline();

  return (
    <header className="shrink-0 px-5 pt-5">
      <div className="flex items-center justify-between">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 text-xs text-stone">
            <li className="inline-flex items-center gap-1.5">
              <Leaf size={13} className="text-moss" />
              {agent.workspace}
            </li>
            <li aria-hidden="true" className="text-line">
              /
            </li>
            <li className="text-bark/70">Agents</li>
          </ol>
        </nav>
        <ThemeToggle />
      </div>

      <div className="mt-3.5 flex items-center gap-2.5">
        <input
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          aria-label="Agent name"
          spellCheck={false}
          className="-mx-1 min-w-0 flex-1 truncate rounded-[8px] bg-transparent px-1 font-serif text-2xl leading-none text-bark outline-none transition-colors hover:bg-canopy/5 focus:bg-canopy/5"
        />
        <StatusDot online={online} />
        <span className="sr-only">
          Engine status: {online ? "online" : "offline"}
        </span>
      </div>
      <p className="mt-1 text-sm text-stone">{draft.description?.trim() || agent.role}</p>
    </header>
  );
}

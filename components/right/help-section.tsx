"use client";

import * as React from "react";
import { SectionCard } from "./section-card";
import { Modal } from "@/components/ui/modal";
import { Help, ChevronLeft, Link as LinkIcon } from "@/components/icons";

type DocLink = { label: string; href: string; note: string };

// Real, working documentation for the technologies this app runs on.
const LINKS: DocLink[] = [
  { label: "Vercel AI SDK", href: "https://ai-sdk.dev/docs/introduction", note: "The runtime, streaming, and tool calling" },
  { label: "Groq console", href: "https://console.groq.com/docs/quickstart", note: "Free, fast models and API keys" },
  { label: "Google AI Studio", href: "https://ai.google.dev/gemini-api/docs", note: "Gemini models and embeddings" },
  { label: "Model Context Protocol", href: "https://modelcontextprotocol.io/introduction", note: "Connect external tool servers" },
];

const TIPS = [
  "Add a provider key in Keys, then pick Auto to let the agent choose a working model.",
  "Turn on Web access and add hosts under Trusted URLs to let the agent browse and fetch.",
  "Describe the agent in Instructions and press Draft to have it write its own system prompt.",
  "Attach files in the composer to ground answers in your own documents.",
];

export function HelpSection({ delay = 0 }: { delay?: number }) {
  const [open, setOpen] = React.useState(false);

  return (
    <SectionCard icon={<Help size={18} />} title="Help" delay={delay} alt>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center justify-between rounded-[12px] py-1 text-left transition-colors"
      >
        <span className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-canopy/10 text-canopy">
            <Help size={16} />
          </span>
          <span className="text-sm font-medium text-bark group-hover:text-canopy">
            Get help
          </span>
        </span>
        <ChevronLeft
          size={16}
          className="rotate-180 text-stone transition-transform group-hover:translate-x-0.5"
        />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Help & docs"
        description="How to get the most out of this agent."
      >
        <div className="space-y-4">
          <ul className="space-y-2">
            {TIPS.map((t) => (
              <li key={t} className="flex gap-2 text-sm text-stone">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-fern" />
                {t}
              </li>
            ))}
          </ul>
          <div className="border-t border-line pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone/70">
              Documentation
            </p>
            <div className="flex flex-col gap-1.5">
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-[10px] border border-line bg-mist/40 px-3 py-2 transition-colors hover:border-moss"
                >
                  <span className="flex items-center gap-2.5">
                    <LinkIcon size={15} className="text-moss" />
                    <span className="text-sm font-medium text-bark group-hover:text-canopy">
                      {l.label}
                    </span>
                  </span>
                  <span className="hidden text-xs text-stone sm:inline">{l.note}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </SectionCard>
  );
}

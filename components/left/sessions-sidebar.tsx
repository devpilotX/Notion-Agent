"use client";

import { SessionsList } from "./sessions-list";
import { Button } from "@/components/ui/button";
import { VineDivider } from "@/components/motion/vine-divider";
import { Sprout, Leaf } from "@/components/icons";
import { useChat } from "@/components/chat/chat-context";

export function SessionsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const chat = useChat();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-4 pt-5">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-bark">
          <Leaf size={16} className="text-moss" />
          Sessions
        </span>
      </div>

      <div className="px-4 pt-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-center gap-1.5"
          onClick={() => {
            chat.newSession();
            onNavigate?.();
          }}
        >
          <Sprout size={16} />
          New session
        </Button>
      </div>

      <div className="mt-3 px-4">
        <VineDivider />
      </div>

      <div className="verdant-scroll mt-2 min-h-0 flex-1 overflow-y-auto pb-4">
        <SessionsList
          activeId={chat.sessionId}
          onSelect={(id) => {
            chat.loadSession(id);
            onNavigate?.();
          }}
        />
      </div>
    </div>
  );
}

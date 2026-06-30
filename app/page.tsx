"use client";

import * as React from "react";
import { LeftPane } from "@/components/left/left-pane";
import { SessionsSidebar } from "@/components/left/sessions-sidebar";
import { RightPane } from "@/components/right/right-pane";
import { AgentConfigProvider } from "@/components/right/agent-config-context";
import { ChatProvider } from "@/components/chat/chat-context";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Sliders, Leaf } from "@/components/icons";
import { cn } from "@/lib/utils";

export default function Page() {
  const [settingsOpen, setSettingsOpen] = React.useState(true);
  const [sessionsOpen, setSessionsOpen] = React.useState(false); // mobile only

  return (
    <main className="relative z-10 lg:h-dvh">
      <AgentConfigProvider>
        <ChatProvider>
          <div className="mx-auto flex h-full max-w-[1600px] flex-col lg:flex-row">
            {/* Left: sessions sidebar. Static column on desktop, slide-over on mobile. */}
            <aside
              aria-label="Sessions"
              className={cn(
                "z-50 w-[280px] shrink-0 border-line bg-mist",
                "fixed inset-y-0 left-0 border-r transition-transform duration-300",
                "lg:static lg:z-auto lg:h-full lg:w-[260px] lg:translate-x-0",
                sessionsOpen ? "translate-x-0 shadow-lift" : "-translate-x-full lg:translate-x-0",
              )}
            >
              <SessionsSidebar onNavigate={() => setSessionsOpen(false)} />
            </aside>
            {sessionsOpen && (
              <div
                aria-hidden="true"
                onClick={() => setSessionsOpen(false)}
                className="fixed inset-0 z-40 bg-bark/30 backdrop-blur-[1px] lg:hidden"
              />
            )}

            {/* Center: chat thread and composer only. */}
            <section
              aria-label="Chat"
              className="flex h-[88vh] min-h-0 flex-1 flex-col lg:h-full"
            >
              <LeftPane />
            </section>

            {/* Right: config panel. */}
            <section
              aria-label="Agent settings"
              className={cn(
                "flex min-h-0 flex-col lg:h-full lg:border-l lg:border-line",
                settingsOpen ? "lg:flex lg:w-[460px] xl:w-[520px]" : "hidden",
              )}
            >
              <RightPane onCollapse={() => setSettingsOpen(false)} />
            </section>
          </div>
        </ChatProvider>
      </AgentConfigProvider>

      {/* Mobile: open sessions */}
      <div className="fixed bottom-6 left-6 z-30 lg:hidden">
        <Tooltip label="Sessions" side="top">
          <Button
            size="icon"
            aria-label="Open sessions"
            className="h-11 w-11 rounded-[16px] shadow-lift"
            onClick={() => setSessionsOpen(true)}
          >
            <Leaf size={20} />
          </Button>
        </Tooltip>
      </div>

      {/* Reopen settings when collapsed (desktop) */}
      <div className={cn("fixed bottom-6 right-6 z-30 hidden", !settingsOpen && "lg:block")}>
        <Tooltip label="Open settings" side="top">
          <Button
            size="icon"
            aria-label="Open settings panel"
            className="h-11 w-11 rounded-[16px] shadow-lift"
            onClick={() => setSettingsOpen(true)}
          >
            <Sliders size={20} />
          </Button>
        </Tooltip>
      </div>
    </main>
  );
}

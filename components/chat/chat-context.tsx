"use client";

import * as React from "react";
import { useRunChat } from "@/lib/api/use-run-chat";

type ChatValue = ReturnType<typeof useRunChat>;

const ChatContext = React.createContext<ChatValue | null>(null);

/** Shares one chat session across the sessions sidebar and the center chat. */
export function ChatProvider({ children }: { children: React.ReactNode }) {
  const chat = useRunChat();
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = React.useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}

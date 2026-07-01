"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AgentHeader } from "./agent-header";
import { ChatHero } from "./chat-hero";
import { ChatThread } from "./chat-thread";
import { ChatScrollArea } from "./chat-scroll-area";
import { MessageInput } from "./message-input";
import { Paperclip, Folder, Close } from "@/components/icons";
import { useToast } from "@/components/ui/toast";
import { useDismiss } from "@/lib/use-dismiss";
import { easeOrganic } from "@/components/motion/motion-tokens";
import { useChat } from "@/components/chat/chat-context";
import { useAgentDraft } from "@/components/right/agent-config-context";
import { useDraftInstructions } from "@/lib/api/agent";
import {
  useDocuments,
  useUploadDocuments,
  useDeleteDocument,
} from "@/lib/api/documents";

/** Detects a chat request to write or change the agent's instructions. */
function wantsInstructions(text: string): boolean {
  const t = text.toLowerCase();
  const verb = /\b(write|create|draft|update|change|set|make|generate|improve|rewrite)\b/.test(t);
  const noun = /\binstructions?\b|\bsystem prompt\b/.test(t);
  return verb && noun;
}

function formatBytes(n?: number): string {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function LeftPane() {
  const [message, setMessage] = React.useState("");
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const filesRef = React.useRef<HTMLInputElement>(null);
  const folderRef = React.useRef<HTMLInputElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const chat = useChat();
  const { toast } = useToast();
  const { draft, set } = useAgentDraft();
  const draftInstr = useDraftInstructions();
  const { documents } = useDocuments();
  const upload = useUploadDocuments();
  const removeDoc = useDeleteDocument();

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [sizes, setSizes] = React.useState<Record<string, number>>({});
  useDismiss(menuOpen, () => setMenuOpen(false), menuRef);

  const handleSend = async (text: string) => {
    setMessage("");
    // A chat request to write or change instructions fills the Settings field
    // on the right instead of answering in the chat.
    if (wantsInstructions(text) && draft.id) {
      const assistantId = chat.pushExchange(text, "Drafting the instructions into Settings…");
      try {
        const { instructions } = await draftInstr.mutateAsync({ id: draft.id, description: text });
        set("instructions", instructions);
        chat.setAssistantText(
          assistantId,
          "I drafted the instructions in the Settings field on the right. Review them, then click Save.",
        );
      } catch {
        chat.setAssistantText(
          assistantId,
          "I could not draft the instructions. Check that a provider key is working, then try again.",
        );
      }
      return;
    }
    chat.send(text);
  };

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    setMenuOpen(false);
    if (files.length === 0) return;
    setSizes((prev) => {
      const next = { ...prev };
      for (const f of files) next[f.name] = f.size;
      return next;
    });
    try {
      const res = await upload.mutateAsync(files);
      const chunks = res.reduce((n, r) => n + r.chunks, 0);
      toast({
        title: chunks > 0 ? "Files added" : "Files received",
        description:
          chunks > 0 ? `${res.length} item(s), ${chunks} chunks indexed` : "No text could be extracted",
        variant: chunks > 0 ? "success" : undefined,
      });
    } catch (err) {
      toast({
        title: "Upload failed",
        description:
          err instanceof Error && err.message && !/^Upload failed/.test(err.message)
            ? err.message
            : "Check that the engine is running, then try again.",
        variant: "danger",
      });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AgentHeader />

      {chat.messages.length === 0 ? (
        <div className="verdant-scroll flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-6">
          <ChatHero onSend={handleSend} />
        </div>
      ) : (
        <ChatScrollArea
          className="mt-2 min-h-0 flex-1"
          messagesCount={chat.messages.length}
          streamTick={chat.messages.reduce(
            (n, m) => n + (m.role === "assistant" ? m.chunks.length : 0),
            0,
          )}
        >
          <ChatThread messages={chat.messages} />
        </ChatScrollArea>
      )}

      {documents.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-1 pt-2">
          {documents.slice(0, 8).map((d) => {
            const size = sizes[d.source] ?? sizes[d.source.split("/").pop() ?? ""];
            const detail = size ? formatBytes(size) : `${d.chunks} chunks`;
            return (
              <span
                key={d.source}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-mist/50 py-1 pl-2.5 pr-1.5 text-xs text-bark"
                title={`${d.source} · ${d.chunks} chunks`}
              >
                <Paperclip size={12} className="text-moss" />
                <span className="max-w-[150px] truncate">{d.source.split("/").pop()}</span>
                <span className="text-stone/70">{detail}</span>
                <button
                  type="button"
                  onClick={() => removeDoc.mutate(d.source)}
                  aria-label={`Remove ${d.source}`}
                  className="grid h-4 w-4 place-items-center rounded-full text-stone transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <Close size={11} />
                </button>
              </span>
            );
          })}
          {documents.length > 8 && (
            <span className="inline-flex items-center rounded-full px-2 py-1 text-xs text-stone">
              +{documents.length - 8} more
            </span>
          )}
        </div>
      )}

      <input ref={filesRef} type="file" multiple hidden onChange={onFiles} aria-hidden="true" />
      <input
        ref={folderRef}
        type="file"
        hidden
        onChange={onFiles}
        aria-hidden="true"
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
      />

      <div ref={menuRef} className="relative px-4">
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.16, ease: easeOrganic }}
              className="absolute bottom-1 left-5 z-40 w-44 rounded-[14px] border border-line bg-paper p-1.5 shadow-lift"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => filesRef.current?.click()}
                className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-sm text-bark transition-colors hover:bg-canopy/10 hover:text-canopy"
              >
                <Paperclip size={16} />
                Upload files
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => folderRef.current?.click()}
                className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-sm text-bark transition-colors hover:bg-canopy/10 hover:text-canopy"
              >
                <Folder size={16} />
                Upload a folder
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <MessageInput
        ref={inputRef}
        value={message}
        onChange={setMessage}
        onSend={handleSend}
        onStop={chat.stop}
        streaming={chat.status === "streaming"}
        onAttachClick={() => setMenuOpen((o) => !o)}
        attachCount={documents.length}
        attachBusy={upload.isPending}
        disabled={chat.status !== "idle"}
      />
    </div>
  );
}

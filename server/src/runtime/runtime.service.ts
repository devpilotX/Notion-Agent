import { Inject, Injectable } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { streamText, stepCountIs, generateText, type ToolSet } from "ai";
import { DRIZZLE } from "../db/db.module";
import type { Database } from "../db/drizzle";
import { apiKeys, messages, runs, sessions } from "../db/schema";
import { CryptoService } from "../crypto/crypto.service";
import { UsersService } from "../users/users.service";
import { AgentsService } from "../agents/agents.service";
import { resolveModel } from "./model-resolver";
import { listModels } from "../keys/provider-validate";
import { buildWebTools } from "./tools";
import { RagService } from "../rag/rag.service";
import { ConnectionsService } from "../connections/connections.service";
import type { RunEvent } from "../streaming/contract";

export type RunInput = {
  agentId: string;
  message: string;
  sessionId?: string;
  model?: string;
  triggerId?: string;
};

type Send = (e: RunEvent) => void;

@Injectable()
export class RuntimeService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly crypto: CryptoService,
    private readonly users: UsersService,
    private readonly agents: AgentsService,
    private readonly rag: RagService,
    private readonly connections: ConnectionsService,
  ) {}

  async run(input: RunInput, send: Send): Promise<void> {
    const runId = randomUUID();
    const startedAt = Date.now();
    const userId = await this.users.getCurrentUserId();
    const agent = await this.agents.getOrCreateDefault(userId);

    let sessionId = input.sessionId;
    if (!sessionId) {
      const [s] = await this.db
        .insert(sessions)
        .values({ agentId: agent.id, userId, title: input.message.slice(0, 60) })
        .returning();
      sessionId = s.id;
    }
    send({ type: "run.start", runId, sessionId });

    await this.db
      .insert(messages)
      .values({ sessionId, role: "user", content: input.message });

    const chooseStep = randomUUID();
    send({ type: "step.start", stepId: chooseStep, label: "Choosing a model" });
    const secrets = await this.workingSecrets(userId);
    const ollamaBase = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
    const ollamaModels = await this.listOllama(ollamaBase);
    const spec =
      input.model && input.model !== "auto"
        ? input.model
        : agent.modelMode === "auto"
          ? "auto"
          : agent.modelId;
    const resolved = await resolveModel(spec, secrets, {
      ollamaBase,
      ollamaModels,
      listModels,
    });
    send({ type: "step.end", stepId: chooseStep });

    if (!resolved) {
      send({
        type: "error",
        message:
          "No working model. Add a provider key in the Keys card, or run Ollama.",
      });
      send({ type: "run.done", runId, status: "error" });
      return;
    }

    const history = await this.db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt));
    // Keep the request small: only the recent turns, within a character budget.
    const convo = trimHistory(
      history.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    );

    // Trivial small talk gets no tools and no document lookup, so a plain
    // "hello" stays cheap and never triggers a tool call.
    const trivial = isTrivial(input.message);

    const respStep = randomUUID();
    send({ type: "step.start", stepId: respStep, label: `Responding with ${resolved.label}` });

    // Web tools, gated by the agent's settings. Empty when Web access is off.
    const settings = (agent.settingsJson as {
      webAccess?: boolean;
      trustedUrls?: string[];
      allowAllUrls?: boolean;
    }) ?? {};
    const web = trivial
      ? {}
      : buildWebTools({
          webAccess: settings.webAccess ?? false,
          trustedUrls: settings.trustedUrls ?? [],
          allowAllUrls: settings.allowAllUrls ?? false,
        });
    // Tools from any connected MCP servers for this agent.
    let mcpClosers: (() => Promise<void>)[] = [];
    let mcpTools = {};
    if (!trivial) {
      try {
        const opened = await this.connections.openMcpToolsets(agent.id);
        mcpTools = opened.tools;
        mcpClosers = opened.closers;
      } catch {
        /* MCP is optional; ignore failures */
      }
    }
    // Keep the tool set small: web tools first, then MCP tools up to a cap.
    // Large MCP catalogs (for example GitHub has 40+) would otherwise bloat
    // every request and can exceed a provider's tool limit.
    const MAX_TOOLS = 24;
    const tools: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(web)) tools[k] = v;
    for (const [k, v] of Object.entries(mcpTools)) {
      if (Object.keys(tools).length >= MAX_TOOLS) break;
      tools[k] = v;
    }
    const hasTools = Object.keys(tools).length > 0;

    let full = "";
    try {
      const baseSystem =
        agent.instructions && agent.instructions.trim().length > 0
          ? agent.instructions
          : `You are ${agent.name}, a calm and helpful agent. Answer clearly and concisely.`;

      // Ground the answer in the agent's uploaded documents when any match.
      let ragContext = "";
      if (!trivial) {
        try {
          const hits = await this.rag.retrieve(agent.id, input.message, 5);
          const strong = hits.filter((h) => h.score > 0.3);
          if (strong.length) {
            const docStep = randomUUID();
            send({ type: "step.start", stepId: docStep, label: "Reading your documents" });
            ragContext =
              "\n\nUse the following context from the user's uploaded documents when relevant. " +
              "Cite the source name in brackets.\n" +
              strong
                .map((h, i) => `[${i + 1}] (${h.source}) ${h.chunk}`)
                .join("\n\n");
            send({ type: "step.end", stepId: docStep });
          }
        } catch {
          /* retrieval is best-effort; ignore failures */
        }
      }
      const toolGuidance = hasTools
        ? "\n\nYou have tools available. Use them only when the task needs external, " +
          "current, or fetched information. For greetings, opinions, and general " +
          "questions you can answer directly, reply without calling a tool."
        : "";
      const system = baseSystem + ragContext + toolGuidance;
      const runStream = async (toolSet: ToolSet) => {
        const result = streamText({
          model: resolved.model,
          system,
          messages: convo,
          ...(Object.keys(toolSet).length
            ? { tools: toolSet, stopWhen: stepCountIs(agent.maxSteps ?? 8) }
            : {}),
        });
        for await (const part of result.fullStream as AsyncIterable<Record<string, unknown>>) {
          const type = part.type as string;
          if (type === "text-delta") {
            const t = (part.text ?? part.textDelta ?? "") as string;
            if (t) {
              full += t;
              send({ type: "message.delta", text: t });
            }
          } else if (type === "tool-call") {
            const name = (part.toolName ?? "tool") as string;
            const id = (part.toolCallId ?? randomUUID()) as string;
            const label =
              name === "web_search"
                ? "Searching the web"
                : name === "web_fetch"
                  ? "Fetching a page"
                  : `Using ${name}`;
            send({ type: "step.start", stepId: id, label });
            send({ type: "tool.call", name, args: (part.input ?? {}) as Record<string, unknown> });
          } else if (type === "tool-result") {
            const name = (part.toolName ?? "tool") as string;
            const id = (part.toolCallId ?? randomUUID()) as string;
            send({ type: "tool.result", name, summary: summarizeToolOutput(part.output) });
            send({ type: "step.end", stepId: id });
          } else if (type === "error") {
            throw (part.error as Error) ?? new Error("stream error");
          }
        }
        return result.usage;
      };

      // Try the full tool set. If the provider rejects the payload before any
      // text is produced, fall back to web tools only, then to no tools, so a
      // reply always comes back and web tools survive a bad MCP tool.
      const webOnly = Object.fromEntries(
        Object.entries(tools).filter(([k]) => k in web),
      ) as ToolSet;
      const tiers: ToolSet[] = [tools as ToolSet];
      if (
        Object.keys(webOnly).length &&
        Object.keys(webOnly).length < Object.keys(tools).length
      ) {
        tiers.push(webOnly);
      }
      tiers.push({} as ToolSet);

      let usagePromise;
      let lastErr: unknown = null;
      for (let i = 0; i < tiers.length; i++) {
        try {
          usagePromise = await runStream(tiers[i]);
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (full.length > 0) throw err; // a partial answer already streamed
          if (i < tiers.length - 1) {
            const retryStep = randomUUID();
            send({
              type: "step.start",
              stepId: retryStep,
              label: i === 0 && tiers.length > 2 ? "Retrying with fewer tools" : "Retrying without tools",
            });
            send({ type: "step.end", stepId: retryStep });
          }
        }
      }
      if (lastErr) throw lastErr;

      const usage = (await usagePromise) as {
        totalTokens?: number;
        inputTokens?: number;
        outputTokens?: number;
      };
      const tokens =
        usage?.totalTokens ?? (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);
      send({ type: "step.end", stepId: respStep });
      send({ type: "usage", tokens: tokens || 0, cost: 0 });
      await this.db
        .insert(messages)
        .values({ sessionId, role: "assistant", content: full, tokens: tokens || 0 });
      await this.db.insert(runs).values({
        agentId: agent.id,
        triggerId: input.triggerId ?? null,
        status: "ok",
        tokens: tokens || 0,
        cost: 0,
        durationMs: Date.now() - startedAt,
      });
      send({ type: "run.done", runId, status: "ok" });
    } catch (err) {
      send({ type: "step.end", stepId: respStep });
      send({ type: "error", message: friendlyError(err) });
      if (full) {
        await this.db
          .insert(messages)
          .values({ sessionId, role: "assistant", content: full });
      }
      await this.db.insert(runs).values({
        agentId: agent.id,
        triggerId: input.triggerId ?? null,
        status: "error",
        tokens: 0,
        cost: 0,
        durationMs: Date.now() - startedAt,
      });
      send({ type: "run.done", runId, status: "error" });
    } finally {
      for (const close of mcpClosers) await close();
    }
  }

  /** Draft agent instructions from a short description, using a working model. */
  async draftInstructions(description: string): Promise<string> {
    const userId = await this.users.getCurrentUserId();
    const secrets = await this.workingSecrets(userId);
    const ollamaBase = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
    const ollamaModels = await this.listOllama(ollamaBase);
    const resolved = await resolveModel("auto", secrets, {
      ollamaBase,
      ollamaModels,
      listModels,
    });
    if (!resolved) {
      throw new Error("No working model. Add a provider key in the Keys card.");
    }
    const { text } = await generateText({
      model: resolved.model,
      system:
        "You write concise, effective system instructions for an AI agent. " +
        "Output only the instructions themselves, written in the second person " +
        "(start with 'You are'). Use 3 to 6 sentences. No preamble, no markdown, no headings.",
      prompt: `Write system instructions for an agent described as:\n\n${description}`,
    });
    return text.trim();
  }

  private async workingSecrets(userId: string): Promise<Map<string, string>> {
    const rows = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId));
    rows.sort(
      (a, b) =>
        (b.status === "working" ? 1 : 0) - (a.status === "working" ? 1 : 0),
    );
    const map = new Map<string, string>();
    for (const r of rows) {
      if (map.has(r.provider)) continue;
      try {
        map.set(r.provider, this.crypto.decrypt(r.secretEncrypted));
      } catch {
        /* skip undecryptable */
      }
    }
    return map;
  }

  private async listOllama(base: string): Promise<string[]> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${base.replace(/\/$/, "")}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      return (data.models ?? []).map((m) => m.name);
    } catch {
      return [];
    }
  }
}

/** Short, human-readable summary of a tool's output for the step trace. */
function summarizeToolOutput(output: unknown): string {
  if (output == null) return "done";
  const o = output as Record<string, unknown>;
  if (o.blocked) return `blocked: ${String(o.reason ?? "not allowed")}`;
  if (o.error) return `error: ${String(o.error)}`;
  if (Array.isArray(o.results)) return `${o.results.length} results`;
  if (typeof o.content === "string") return `${o.content.length} chars fetched`;
  const s = typeof output === "string" ? output : JSON.stringify(output);
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}



/** True for greetings and small talk that need no tools or document lookup. */
function isTrivial(message: string): boolean {
  const t = message.trim().toLowerCase().replace(/[!.?]+$/g, "");
  if (t.length > 40) return false;
  if (
    /^(hi|hello|hey|yo|hiya|howdy|sup|gm|good (morning|afternoon|evening)|thanks|thank you|thx|ty|ok|okay|cool|nice|great|got it|hello there)$/.test(
      t,
    )
  ) {
    return true;
  }
  return /^(how are you|how's it going|what'?s up|who are you|what can you do)/.test(t);
}

type Turn = { role: "user" | "assistant" | "system"; content: string };

/** Keep only the recent turns within a character budget to control token use. */
function trimHistory(convo: Turn[], maxMessages = 16, maxChars = 12000): Turn[] {
  let kept = convo.slice(-maxMessages);
  let total = kept.reduce((n, m) => n + m.content.length, 0);
  while (kept.length > 1 && total > maxChars) {
    total -= kept[0].content.length;
    kept = kept.slice(1);
  }
  return kept;
}

/** Map raw provider errors to a short, readable message for the UI. */
function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const m = raw.toLowerCase();
  if (/context length|maximum context|too many tokens|reduce the length|context_length/.test(m))
    return "That request was too long for the chosen model. Start a new session, or pick a model with a larger context window.";
  if (/rate.?limit|\b429\b|too many requests/.test(m))
    return "The provider is rate limiting right now. Wait a moment, or switch providers.";
  if (/\b401\b|unauthorized|invalid.?api.?key|invalid_api_key/.test(m))
    return "The provider rejected the key. Check it in the Keys card.";
  if (/\b403\b|forbidden|permission/.test(m))
    return "The provider denied access for this key or model.";
  if (/\b404\b|not found|model.*(not|does not) exist|no endpoints/.test(m))
    return "That model is not available on your key. Pick another model.";
  if (/quota|insufficient|billing|payment|no credit|credits/.test(m))
    return "The provider reports no available quota or credit for this key.";
  if (/timeout|timed out|fetch failed|network|econn|enotfound|socket/.test(m))
    return "Could not reach the provider. Check the connection and try again.";
  return "The model call failed. Try again, or pick a different model.";
}

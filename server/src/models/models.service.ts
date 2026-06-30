import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "../db/db.module";
import type { Database } from "../db/drizzle";
import { apiKeys } from "../db/schema";
import { CryptoService } from "../crypto/crypto.service";
import { UsersService } from "../users/users.service";
import { validateKey, listModels } from "../keys/provider-validate";
import { resolveModel } from "../runtime/model-resolver";

export type ModelOption = { id: string; label: string; tier: "free" | "paid" };
export type ModelGroup = { provider: string; options: ModelOption[] };

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  mistral: "Mistral",
  google: "Google",
  groq: "Groq",
  openrouter: "OpenRouter",
  xai: "xAI Grok",
  deepseek: "DeepSeek",
  cohere: "Cohere",
  together: "Together AI",
};

@Injectable()
export class ModelsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly crypto: CryptoService,
    private readonly users: UsersService,
  ) {}

  /** Models unlocked by the user's working keys, plus any local Ollama models. */
  async list(): Promise<ModelGroup[]> {
    const groups: ModelGroup[] = [
      { provider: "Recommended", options: [{ id: "auto", label: "Auto", tier: "free" }] },
    ];

    const ollama = await this.listOllama();
    if (ollama.length) groups.push({ provider: "Ollama (local)", options: ollama });

    const userId = await this.users.getCurrentUserId();
    const keys = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId));

    // One key per provider (the first one we find).
    const byProvider = new Map<string, (typeof keys)[number]>();
    for (const k of keys) if (!byProvider.has(k.provider)) byProvider.set(k.provider, k);

    for (const [provider, key] of byProvider) {
      const secret = this.safeDecrypt(key.secretEncrypted);
      if (!secret) continue;
      const { status, models } = await validateKey(provider, secret, key.baseUrl);
      if (status !== key.status) {
        await this.db.update(apiKeys).set({ status }).where(eq(apiKeys.id, key.id));
      }
      if (status !== "working") continue;
      const options = this.toOptions(provider, models);
      if (options.length) {
        groups.push({ provider: PROVIDER_LABEL[provider] ?? provider, options });
      }
    }

    return groups;
  }

  /** The model Auto would pick right now, for display in the UI. */
  async autoChoice(): Promise<{ label: string | null }> {
    const userId = await this.users.getCurrentUserId();
    const keys = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId));
    const secrets = new Map<string, string>();
    for (const k of keys) {
      if (secrets.has(k.provider)) continue;
      const s = this.safeDecrypt(k.secretEncrypted);
      if (s) secrets.set(k.provider, s);
    }
    const ollamaBase = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
    const ollamaModels = (await this.listOllama()).map((o) => o.label);
    const resolved = await resolveModel("auto", secrets, {
      ollamaBase,
      ollamaModels,
      listModels,
    });
    return { label: resolved?.label ?? null };
  }

  private safeDecrypt(enc: string): string | null {
    try {
      return this.crypto.decrypt(enc);
    } catch {
      return null;
    }
  }

  private toOptions(provider: string, models: string[]): ModelOption[] {
    let ids = models;
    // OpenAI lists many non-chat models; keep the chat-capable ones.
    if (provider === "openai") {
      ids = models.filter((m) => /^(gpt-|o1|o3|o4|chatgpt)/.test(m));
    }
    const isFree = (id: string) =>
      provider === "groq" || /:free$/i.test(id) || /-free\b|free-/i.test(id);
    // Free models first so they are never dropped by the cap, then cap high
    // enough that big catalogs (OpenRouter) stay usable in the picker.
    const sorted = [...ids].sort((a, b) => Number(isFree(b)) - Number(isFree(a)));
    return sorted.slice(0, 200).map((id) => ({
      id: `${provider}:${id}`,
      label: id,
      tier: isFree(id) ? ("free" as const) : ("paid" as const),
    }));
  }

  private async listOllama(): Promise<ModelOption[]> {
    const base = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${base}/api/tags`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      return (data.models ?? [])
        .map((m) => ({ id: `ollama:${m.name}`, label: m.name, tier: "free" as const }))
        .slice(0, 50);
    } catch {
      return [];
    }
  }
}

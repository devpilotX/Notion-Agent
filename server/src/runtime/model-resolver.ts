import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createMistral } from "@ai-sdk/mistral";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

/** Preference order for Auto when several providers have a key. Free and
 *  low-cost providers come first so Auto stays cost-safe. */
export const PROVIDER_RANK = [
  "groq",
  "openrouter",
  "google",
  "deepseek",
  "together",
  "mistral",
  "cohere",
  "xai",
  "anthropic",
  "openai",
];

/** Preferred model per provider, used only if present in the live list. */
export const PREFERRED: Record<string, string[]> = {
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  google: ["gemini-2.5-flash", "gemini-2.0-flash"],
  openai: ["gpt-4o-mini", "gpt-4o"],
  anthropic: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest"],
  mistral: ["mistral-small-latest", "mistral-large-latest"],
  openrouter: ["meta-llama/llama-3.1-8b-instruct:free", "google/gemini-2.0-flash-exp:free"],
  deepseek: ["deepseek-chat"],
  together: ["meta-llama/Llama-3.3-70B-Instruct-Turbo-Free", "meta-llama/Llama-3.2-3B-Instruct-Turbo"],
  cohere: ["command-r", "command-r-plus"],
  xai: ["grok-3-mini", "grok-2-1212"],
};

export type Resolved = { model: LanguageModel; label: string };

function providerModel(
  provider: string,
  id: string,
  secret: string,
): LanguageModel | null {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey: secret })(id);
    case "openai":
      return createOpenAI({ apiKey: secret })(id);
    case "mistral":
      return createMistral({ apiKey: secret })(id);
    case "google":
      return createGoogleGenerativeAI({ apiKey: secret })(id);
    case "groq":
      return createGroq({ apiKey: secret })(id);
    case "openrouter":
      return createOpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: secret })(id);
    case "xai":
      return createOpenAI({ baseURL: "https://api.x.ai/v1", apiKey: secret })(id);
    case "deepseek":
      return createOpenAI({ baseURL: "https://api.deepseek.com", apiKey: secret })(id);
    case "together":
      return createOpenAI({ baseURL: "https://api.together.xyz/v1", apiKey: secret })(id);
    case "cohere":
      return createOpenAI({ baseURL: "https://api.cohere.ai/compatibility/v1", apiKey: secret })(id);
    default:
      return null;
  }
}

function ollamaModel(id: string, base: string): LanguageModel {
  const ollama = createOpenAI({
    baseURL: `${base.replace(/\/$/, "")}/v1`,
    apiKey: "ollama",
  });
  return ollama(id);
}

function splitSpec(spec: string): [string, string] {
  const i = spec.indexOf(":");
  return i === -1 ? [spec, ""] : [spec.slice(0, i), spec.slice(i + 1)];
}

function pick(available: string[], preferred: string[]): string | null {
  for (const p of preferred) if (available.includes(p)) return p;
  return available[0] ?? null;
}

export type ResolveOptions = {
  ollamaBase: string;
  ollamaModels: string[];
  listModels: (provider: string, secret: string) => Promise<string[]>;
};

/**
 * Resolve a model spec to a provider client. Auto only ever picks from the
 * live model list, so a model the key cannot call is never selected.
 */
export async function resolveModel(
  spec: string | null | undefined,
  secrets: Map<string, string>,
  opts: ResolveOptions,
): Promise<Resolved | null> {
  if (spec && spec !== "auto") {
    const [provider, id] = splitSpec(spec);
    if (provider === "ollama") {
      return { model: ollamaModel(id, opts.ollamaBase), label: spec };
    }
    const secret = secrets.get(provider);
    if (!secret) return null;
    const model = providerModel(provider, id, secret);
    return model ? { model, label: spec } : null;
  }

  // Auto: cost-safe. Prefer free options, fall back to the cheapest paid model.
  // 1. Local Ollama is free, so use it first when present.
  if (opts.ollamaModels.length) {
    return {
      model: ollamaModel(opts.ollamaModels[0], opts.ollamaBase),
      label: `ollama:${opts.ollamaModels[0]}`,
    };
  }

  // Gather live model lists for every provider that has a key.
  const available: Record<string, string[]> = {};
  for (const provider of PROVIDER_RANK) {
    const secret = secrets.get(provider);
    if (!secret) continue;
    available[provider] = await opts.listModels(provider, secret);
  }

  // 2. Prefer an explicitly free model from any provider, in rank order.
  for (const provider of PROVIDER_RANK) {
    const list = available[provider];
    if (!list?.length) continue;
    const free = pickFree(provider, list);
    if (free) {
      const model = providerModel(provider, free, secrets.get(provider)!);
      if (model) return { model, label: `${provider}:${free}` };
    }
  }

  // 3. Otherwise the cheapest available model (PREFERRED lists cheap first).
  for (const provider of PROVIDER_RANK) {
    const list = available[provider];
    if (!list?.length) continue;
    const chosen = pick(list, PREFERRED[provider] ?? []);
    if (chosen) {
      const model = providerModel(provider, chosen, secrets.get(provider)!);
      if (model) return { model, label: `${provider}:${chosen}` };
    }
  }
  return null;
}

/** A clearly free model for a provider, or null if it has none. */
function pickFree(provider: string, list: string[]): string | null {
  if (provider === "groq") return pick(list, PREFERRED.groq ?? []) ?? list[0];
  if (provider === "openrouter") return list.find((id) => /:free$/i.test(id)) ?? null;
  if (provider === "together") return list.find((id) => /free/i.test(id)) ?? null;
  return null;
}

import { createHash } from "node:crypto";

export type KeyStatus = "working" | "invalid" | "rate-limited" | "unknown";
export type ValidateResult = { status: KeyStatus; models: string[] };

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; result: ValidateResult }>();

function cacheKey(provider: string, secret: string, baseUrl?: string | null) {
  const h = createHash("sha256").update(secret).digest("hex").slice(0, 16);
  return `${provider}|${baseUrl ?? ""}|${h}`;
}

/**
 * Check a provider key by listing its models. Working if models come back,
 * invalid on 401/403, rate-limited on 429. Results are cached briefly so the
 * runtime and /models do not double-call the provider.
 */
export async function validateKey(
  provider: string,
  secret: string,
  baseUrl?: string | null,
  useCache = true,
): Promise<ValidateResult> {
  const key = cacheKey(provider, secret, baseUrl);
  if (useCache) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.result;
  }
  const result = await doValidate(provider, secret, baseUrl);
  cache.set(key, { at: Date.now(), result });
  return result;
}

/** Live chat-capable model ids for a provider key (cached briefly). */
export async function listModels(
  provider: string,
  secret: string,
  baseUrl?: string | null,
): Promise<string[]> {
  return (await validateKey(provider, secret, baseUrl)).models;
}

async function doValidate(
  provider: string,
  secret: string,
  baseUrl?: string | null,
): Promise<ValidateResult> {
  try {
    switch (provider) {
      case "google":
        return await checkGoogle(secret, baseUrl);
      case "openai":
        return await checkOpenAiStyle(
          `${trim(baseUrl) ?? "https://api.openai.com"}/v1/models`,
          bearer(secret),
          "openai",
        );
      case "mistral":
        return await checkOpenAiStyle(
          `${trim(baseUrl) ?? "https://api.mistral.ai"}/v1/models`,
          bearer(secret),
          "mistral",
        );
      case "groq":
        return await checkOpenAiStyle(
          `${trim(baseUrl) ?? "https://api.groq.com/openai"}/v1/models`,
          bearer(secret),
          "groq",
        );
      case "anthropic":
        return await checkOpenAiStyle(
          `${trim(baseUrl) ?? "https://api.anthropic.com"}/v1/models`,
          { "x-api-key": secret, "anthropic-version": "2023-06-01" },
          "anthropic",
        );
      case "openrouter":
        return await checkOpenRouter(secret, baseUrl);
      case "xai":
        return await checkOpenAiStyle(
          `${trim(baseUrl) ?? "https://api.x.ai"}/v1/models`,
          bearer(secret),
          "xai",
        );
      case "deepseek":
        return await checkOpenAiStyle(
          `${trim(baseUrl) ?? "https://api.deepseek.com"}/models`,
          bearer(secret),
          "deepseek",
        );
      case "together":
        return await checkOpenAiStyle(
          `${trim(baseUrl) ?? "https://api.together.xyz"}/v1/models`,
          bearer(secret),
          "together",
        );
      case "cohere":
        return await checkOpenAiStyle(
          `${trim(baseUrl) ?? "https://api.cohere.com"}/v1/models`,
          bearer(secret),
          "cohere",
        );
      default:
        return { status: "unknown", models: [] };
    }
  } catch {
    return { status: "unknown", models: [] };
  }
}

function bearer(secret: string) {
  return { Authorization: `Bearer ${secret}` };
}

function trim(u?: string | null) {
  return u ? u.replace(/\/$/, "") : undefined;
}

async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  ms = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function checkGoogle(
  secret: string,
  baseUrl?: string | null,
): Promise<ValidateResult> {
  const base = trim(baseUrl) ?? "https://generativelanguage.googleapis.com";
  const res = await fetchWithTimeout(
    `${base}/v1beta/models?key=${encodeURIComponent(secret)}&pageSize=1000`,
    {},
  );
  if (res.status === 401 || res.status === 403) return { status: "invalid", models: [] };
  if (res.status === 429) return { status: "rate-limited", models: [] };
  if (!res.ok) return { status: "unknown", models: [] };

  const data = (await res.json()) as {
    models?: Array<{ name: string; supportedGenerationMethods?: string[] }>;
  };
  const models = (data.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((id) => id.startsWith("gemini"))
    .filter((id) => !id.includes("1.5")) // drop the retired 1.5 family
    .filter((id) => !id.includes("embedding"))
    .filter((id, i, a) => a.indexOf(id) === i);
  return { status: "working", models };
}

async function checkOpenRouter(
  secret: string,
  baseUrl?: string | null,
): Promise<ValidateResult> {
  const base = trim(baseUrl) ?? "https://openrouter.ai/api";
  // The models list is public, so validate the key against the key endpoint.
  const keyRes = await fetchWithTimeout(`${base}/v1/key`, bearer(secret));
  if (keyRes.status === 401 || keyRes.status === 403) return { status: "invalid", models: [] };
  if (keyRes.status === 429) return { status: "rate-limited", models: [] };

  const res = await fetchWithTimeout(`${base}/v1/models`, bearer(secret));
  if (!res.ok) return { status: keyRes.ok ? "working" : "unknown", models: [] };
  const data = (await res.json()) as { data?: Array<{ id?: string }> };
  const models = (data.data ?? [])
    .map((m) => m.id)
    .filter(Boolean) as string[];
  return { status: "working", models };
}

async function checkOpenAiStyle(
  url: string,
  headers: Record<string, string>,
  provider: string,
): Promise<ValidateResult> {
  const res = await fetchWithTimeout(url, headers);
  if (res.status === 401 || res.status === 403) return { status: "invalid", models: [] };
  if (res.status === 429) return { status: "rate-limited", models: [] };
  if (!res.ok) return { status: "unknown", models: [] };

  const data = (await res.json()) as {
    data?: Array<{ id?: string; name?: string }>;
    models?: Array<{ id?: string; name?: string }>;
  };
  const arr = Array.isArray(data)
    ? (data as Array<{ id?: string; name?: string }>)
    : Array.isArray(data.data)
      ? data.data
      : Array.isArray(data.models)
        ? data.models
        : [];
  let ids = arr.map((m) => m.id ?? m.name).filter(Boolean) as string[];

  if (provider === "openai") {
    ids = ids.filter((id) => /^(gpt-|o1|o3|o4|chatgpt)/.test(id));
  }
  if (provider === "groq") {
    ids = ids.filter((id) => !/(whisper|tts|guard)/i.test(id));
  }
  if (provider === "cohere") {
    ids = ids.filter((id) => !/(embed|rerank)/i.test(id));
  }
  return {
    status: "working",
    models: ids.filter((id, i, a) => a.indexOf(id) === i).slice(0, 100),
  };
}

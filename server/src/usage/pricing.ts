/**
 * Cost estimation for runs. Prices are USD per 1M tokens (input, output),
 * matched by the longest prefix of the "provider:model" label the resolver
 * produces. They are estimates — providers change prices; edit this table to
 * match your billing. Unknown models cost 0 so totals never overstate.
 */

export type Price = { in: number; out: number };

// Longest-prefix wins, so keep more specific entries above shorter ones.
const PRICES: Array<[prefix: string, price: Price]> = [
  // OpenAI
  ["openai:gpt-4o-mini", { in: 0.15, out: 0.6 }],
  ["openai:gpt-4o", { in: 2.5, out: 10 }],
  ["openai:gpt-4.1-nano", { in: 0.1, out: 0.4 }],
  ["openai:gpt-4.1-mini", { in: 0.4, out: 1.6 }],
  ["openai:gpt-4.1", { in: 2, out: 8 }],
  ["openai:o3-mini", { in: 1.1, out: 4.4 }],
  ["openai:o3", { in: 2, out: 8 }],
  ["openai:o4-mini", { in: 1.1, out: 4.4 }],
  ["openai:chatgpt-4o", { in: 5, out: 15 }],

  // Anthropic
  ["anthropic:claude-3-5-haiku", { in: 0.8, out: 4 }],
  ["anthropic:claude-3-5-sonnet", { in: 3, out: 15 }],
  ["anthropic:claude-3-7-sonnet", { in: 3, out: 15 }],
  ["anthropic:claude-sonnet-4", { in: 3, out: 15 }],
  ["anthropic:claude-opus-4", { in: 15, out: 75 }],
  ["anthropic:claude-3-haiku", { in: 0.25, out: 1.25 }],
  ["anthropic:claude-3-opus", { in: 15, out: 75 }],

  // Google
  ["google:gemini-2.5-flash-lite", { in: 0.1, out: 0.4 }],
  ["google:gemini-2.5-flash", { in: 0.3, out: 2.5 }],
  ["google:gemini-2.5-pro", { in: 1.25, out: 10 }],
  ["google:gemini-2.0-flash-lite", { in: 0.075, out: 0.3 }],
  ["google:gemini-2.0-flash", { in: 0.1, out: 0.4 }],

  // Groq (paid tier rates; the free tier bills nothing)
  ["groq:llama-3.3-70b-versatile", { in: 0.59, out: 0.79 }],
  ["groq:llama-3.1-8b-instant", { in: 0.05, out: 0.08 }],
  ["groq:gemma2-9b-it", { in: 0.2, out: 0.2 }],

  // Mistral
  ["mistral:mistral-large", { in: 2, out: 6 }],
  ["mistral:mistral-small", { in: 0.1, out: 0.3 }],
  ["mistral:open-mistral-nemo", { in: 0.15, out: 0.15 }],
  ["mistral:codestral", { in: 0.3, out: 0.9 }],

  // DeepSeek
  ["deepseek:deepseek-chat", { in: 0.27, out: 1.1 }],
  ["deepseek:deepseek-reasoner", { in: 0.55, out: 2.19 }],

  // xAI
  ["xai:grok-3-mini", { in: 0.3, out: 0.5 }],
  ["xai:grok-3", { in: 3, out: 15 }],
  ["xai:grok-2", { in: 2, out: 10 }],

  // Cohere
  ["cohere:command-r-plus", { in: 2.5, out: 10 }],
  ["cohere:command-r", { in: 0.15, out: 0.6 }],
  ["cohere:command-a", { in: 2.5, out: 10 }],

  // Together (turbo Llama endpoints)
  ["together:meta-llama/Llama-3.3-70B-Instruct-Turbo", { in: 0.88, out: 0.88 }],
  ["together:meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", { in: 0.18, out: 0.18 }],
];

/** Price for a resolved model label, or null when unknown. Free is explicit 0. */
export function priceFor(label: string): Price | null {
  const l = label.toLowerCase();
  // Local and explicitly-free models never bill.
  if (l.startsWith("ollama:")) return { in: 0, out: 0 };
  if (/:free$/.test(l)) return { in: 0, out: 0 };
  if (/-free\b|free-/i.test(l.split(":").slice(1).join(":"))) return { in: 0, out: 0 };

  let best: Price | null = null;
  let bestLen = 0;
  for (const [prefix, price] of PRICES) {
    if (l.startsWith(prefix.toLowerCase()) && prefix.length > bestLen) {
      best = price;
      bestLen = prefix.length;
    }
  }
  return best;
}

/** Estimated USD cost of a run; 0 for free, local, or unknown models. */
export function estimateCost(
  label: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = priceFor(label);
  if (!price) return 0;
  const cost =
    (Math.max(0, inputTokens) / 1_000_000) * price.in +
    (Math.max(0, outputTokens) / 1_000_000) * price.out;
  return Math.round(cost * 1e6) / 1e6; // keep micro-dollar precision
}

import { tool, jsonSchema, type ToolSet } from "ai";

export type WebToolOptions = {
  webAccess: boolean;
  trustedUrls: string[];
  allowAllUrls: boolean;
};

/** Hostnames that must never be fetched, even with "allow every URL" on. */
function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0" || h === "::1" || h === "[::1]") return true;
  // IPv4 private / loopback / link-local ranges.
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  return false;
}

/** A URL is allowed if "allow every URL" is on (minus private hosts), or its
 *  host matches a trusted entry (exact or subdomain). */
export function isUrlAllowed(
  rawUrl: string,
  trustedUrls: string[],
  allowAllUrls: boolean,
): { ok: boolean; reason?: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Not a valid URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http and https are allowed" };
  }
  if (isPrivateHost(url.hostname)) {
    return { ok: false, reason: "Private and local addresses are blocked" };
  }
  if (allowAllUrls) return { ok: true };

  const host = url.hostname.toLowerCase();
  const trusted = trustedUrls.some((entry) => {
    const e = entry
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
    if (!e) return false;
    return host === e || host.endsWith(`.${e}`);
  });
  return trusted
    ? { ok: true }
    : {
        ok: false,
        reason: `Host "${host}" is not in Trusted URLs. Add it, or turn on Allow every URL.`,
      };
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url: string, ms = 9000): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "VerdantAgent/1.0 (+https://agentforge.dev)" },
      redirect: "follow",
    });
    const body = await res.text();
    const ct = res.headers.get("content-type") ?? "";
    const text = ct.includes("html") ? htmlToText(body) : body;
    return { status: res.status, text };
  } finally {
    clearTimeout(timer);
  }
}

/** DuckDuckGo HTML results, parsed without an API key. */
async function duckSearch(query: string): Promise<{ title: string; url: string }[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const { text } = await rawFetch(url);
  const results: { title: string; url: string }[] = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && results.length < 6) {
    let href = m[1];
    const dd = href.match(/uddg=([^&]+)/);
    if (dd) href = decodeURIComponent(dd[1]);
    results.push({ url: href, title: htmlToText(m[2]).slice(0, 160) });
  }
  return results;
}

async function rawFetch(url: string, ms = 9000): Promise<{ text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; VerdantAgent/1.0)" },
    });
    return { text: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build the web tool set. Returns an empty object when Web access is off, so
 * the model is given no web tools at all.
 */
export function buildWebTools(opts: WebToolOptions): ToolSet {
  if (!opts.webAccess) return {};

  return {
    web_search: tool({
      description:
        "Search the public web for a query and return a short list of result titles and URLs. Use this to find pages, then web_fetch to read one.",
      inputSchema: jsonSchema<{ query: string }>({
        type: "object",
        properties: { query: { type: "string", description: "The search query" } },
        required: ["query"],
        additionalProperties: false,
      }),
      execute: async ({ query }: { query: string }) => {
        try {
          const results = await duckSearch(query);
          if (results.length === 0) return { results: [], note: "No results found." };
          return { results };
        } catch (e) {
          return { results: [], error: e instanceof Error ? e.message : "search failed" };
        }
      },
    }),

    web_fetch: tool({
      description:
        "Fetch a single URL and return its readable text. Subject to the agent's Trusted URLs policy.",
      inputSchema: jsonSchema<{ url: string }>({
        type: "object",
        properties: { url: { type: "string", description: "The full http(s) URL to fetch" } },
        required: ["url"],
        additionalProperties: false,
      }),
      execute: async ({ url }: { url: string }) => {
        const gate = isUrlAllowed(url, opts.trustedUrls, opts.allowAllUrls);
        if (!gate.ok) return { blocked: true, reason: gate.reason };
        try {
          const { status, text } = await fetchText(url);
          return { status, url, content: text.slice(0, 4000) };
        } catch (e) {
          return { error: e instanceof Error ? e.message : "fetch failed", url };
        }
      },
    }),
  };
}

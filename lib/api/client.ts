const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** True when an API base URL is configured. When false, the UI uses fixtures. */
export function apiConfigured(): boolean {
  return Boolean(BASE);
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  if (!BASE) throw new ApiError(0, "API base URL is not configured");
  const res = await fetch(`${BASE}${path}`, {
    method,
    signal,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    // Prefer the engine's message (validation issues, auth errors) over a code.
    const body = (await res.json().catch(() => null)) as
      | { message?: string | string[] }
      | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message || `${method} ${path} failed (${res.status})`;
    if (res.status === 401 && typeof window !== "undefined") {
      // Session missing or expired: let the auth gate re-check.
      window.dispatchEvent(new CustomEvent("verdant:unauthorized"));
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>("GET", path, undefined, signal),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};

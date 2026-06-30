/**
 * Streaming contract consumed by the chat and step trace.
 * Keep this in sync with the engine copy at server/src/streaming/contract.ts.
 */

export type RunStatus = "ok" | "error" | "cancelled";

export type RunEvent =
  | { type: "run.start"; runId: string; sessionId?: string }
  | { type: "step.start"; stepId: string; label: string }
  | { type: "message.delta"; text: string }
  | { type: "tool.call"; name: string; args: Record<string, unknown> }
  | { type: "tool.result"; name: string; summary: string }
  | { type: "step.end"; stepId: string }
  | { type: "usage"; tokens: number; cost: number }
  | { type: "run.done"; runId: string; status: RunStatus }
  | { type: "error"; message: string };

export type RunEventType = RunEvent["type"];

/** Parse one SSE "data:" payload into a typed RunEvent, or null if invalid. */
export function parseRunEvent(data: string): RunEvent | null {
  try {
    const parsed = JSON.parse(data) as RunEvent;
    return parsed && typeof parsed.type === "string" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Read an SSE Response body and yield typed RunEvents.
 * Used by the chat once the live run endpoint is wired in Phase 4.
 */
export async function* readRunStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<RunEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of frame.split("\n")) {
        if (line.startsWith("data:")) {
          const event = parseRunEvent(line.slice(5).trim());
          if (event) yield event;
        }
      }
    }
  }
}

/**
 * Streaming contract between the engine and the Verdant UI.
 * Keep this in sync with the frontend copy at lib/streaming-contract.ts.
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

/** Encode a run event as a Server-Sent-Events frame. */
export function sseFrame(event: RunEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

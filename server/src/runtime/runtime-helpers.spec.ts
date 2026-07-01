import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  friendlyError,
  isAbortError,
  isTrivial,
  summarizeToolOutput,
  trimHistory,
  type Turn,
} from "./runtime.service";

describe("isTrivial", () => {
  it("treats greetings and small talk as trivial", () => {
    for (const m of ["hi", "Hello!", "hey", "thanks", "ok", "How are you?"]) {
      assert.equal(isTrivial(m), true, m);
    }
  });

  it("treats real questions as non-trivial", () => {
    for (const m of [
      "What is the capital of France?",
      "Summarize the attached report and list the top three risks it mentions",
      "hi, can you fetch https://example.com and summarize it",
    ]) {
      assert.equal(isTrivial(m), false, m);
    }
  });
});

describe("trimHistory", () => {
  const turn = (content: string): Turn => ({ role: "user", content });

  it("keeps short conversations untouched", () => {
    const convo = [turn("a"), turn("b")];
    assert.deepEqual(trimHistory(convo), convo);
  });

  it("caps the number of messages", () => {
    const convo = Array.from({ length: 30 }, (_, i) => turn(`m${i}`));
    const kept = trimHistory(convo, 16);
    assert.equal(kept.length, 16);
    assert.equal(kept[15].content, "m29"); // newest survive
  });

  it("drops oldest turns over the character budget but keeps at least one", () => {
    const big = "x".repeat(10_000);
    const kept = trimHistory([turn(big), turn(big), turn("latest")], 16, 12_000);
    assert.equal(kept[kept.length - 1].content, "latest");
    assert.ok(kept.length >= 1);
    assert.ok(kept.reduce((n, m) => n + m.content.length, 0) <= 12_000);
  });
});

describe("friendlyError", () => {
  const cases: Array<[string, RegExp]> = [
    ["Request failed with status 429 Too Many Requests", /rate limiting/],
    ["401 Unauthorized: invalid_api_key", /rejected the key/],
    ["403 Forbidden", /denied access/],
    ["model does not exist or no endpoints found", /not available/],
    ["insufficient quota, check billing", /quota or credit/],
    ["fetch failed: ENOTFOUND api.example.com", /Could not reach/],
    ["maximum context length exceeded", /too long/],
    ["something entirely novel", /model call failed/],
  ];
  for (const [raw, expected] of cases) {
    it(`maps "${raw.slice(0, 40)}"`, () => {
      assert.match(friendlyError(new Error(raw)), expected);
    });
  }
});

describe("summarizeToolOutput", () => {
  it("summarizes common shapes", () => {
    assert.equal(summarizeToolOutput(null), "done");
    assert.equal(summarizeToolOutput({ blocked: true, reason: "nope" }), "blocked: nope");
    assert.equal(summarizeToolOutput({ error: "boom" }), "error: boom");
    assert.equal(summarizeToolOutput({ results: [1, 2, 3] }), "3 results");
    assert.equal(summarizeToolOutput({ content: "abcd" }), "4 chars fetched");
  });

  it("truncates long payloads", () => {
    const s = summarizeToolOutput({ data: "y".repeat(500) });
    assert.ok(s.length <= 121);
  });
});

describe("isAbortError", () => {
  it("detects abort errors by name and message", () => {
    const e = new Error("The operation was aborted");
    assert.equal(isAbortError(e), true);
    const named = new Error("stopped");
    named.name = "AbortError";
    assert.equal(isAbortError(named), true);
  });

  it("ignores ordinary errors and non-errors", () => {
    assert.equal(isAbortError(new Error("rate limited")), false);
    assert.equal(isAbortError("aborted"), false);
    assert.equal(isAbortError(undefined), false);
  });
});

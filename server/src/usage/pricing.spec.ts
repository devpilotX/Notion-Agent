import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estimateCost, priceFor } from "./pricing";

describe("priceFor", () => {
  it("treats ollama and :free models as zero-cost", () => {
    assert.deepEqual(priceFor("ollama:llama3:8b"), { in: 0, out: 0 });
    assert.deepEqual(priceFor("openrouter:meta-llama/llama-3.1-8b-instruct:free"), {
      in: 0,
      out: 0,
    });
    assert.deepEqual(
      priceFor("together:meta-llama/Llama-3.3-70B-Instruct-Turbo-Free"),
      { in: 0, out: 0 },
    );
  });

  it("matches known models by longest prefix", () => {
    assert.deepEqual(priceFor("openai:gpt-4o-mini"), { in: 0.15, out: 0.6 });
    assert.deepEqual(priceFor("openai:gpt-4o-2024-08-06"), { in: 2.5, out: 10 });
    assert.deepEqual(priceFor("groq:llama-3.3-70b-versatile"), { in: 0.59, out: 0.79 });
    assert.deepEqual(priceFor("anthropic:claude-3-5-haiku-latest"), { in: 0.8, out: 4 });
  });

  it("returns null for unknown models", () => {
    assert.equal(priceFor("openrouter:some/new-model"), null);
    assert.equal(priceFor("openai:gpt-9"), null);
  });
});

describe("estimateCost", () => {
  it("computes input and output at their own rates", () => {
    // gpt-4o-mini: $0.15/M in, $0.60/M out
    const cost = estimateCost("openai:gpt-4o-mini", 1_000_000, 500_000);
    assert.ok(Math.abs(cost - (0.15 + 0.3)) < 1e-9);
  });

  it("is zero for unknown, free, and local models", () => {
    assert.equal(estimateCost("openrouter:some/new-model", 1e6, 1e6), 0);
    assert.equal(estimateCost("groq:llama-3.3-70b-versatile:free", 1e6, 1e6), 0);
    assert.equal(estimateCost("ollama:phi3", 1e6, 1e6), 0);
  });

  it("never goes negative on bad inputs", () => {
    assert.equal(estimateCost("openai:gpt-4o", -100, -100), 0);
  });
});

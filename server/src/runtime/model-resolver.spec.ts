import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveModel, type ResolveOptions } from "./model-resolver";

const opts = (
  models: Record<string, string[]> = {},
  ollamaModels: string[] = [],
): ResolveOptions => ({
  ollamaBase: "http://localhost:11434",
  ollamaModels,
  listModels: async (provider) => models[provider] ?? [],
});

describe("resolveModel (manual spec)", () => {
  it("resolves provider:model when a key exists", async () => {
    const r = await resolveModel(
      "groq:llama-3.3-70b-versatile",
      new Map([["groq", "gsk_x"]]),
      opts(),
    );
    assert.ok(r);
    assert.equal(r.label, "groq:llama-3.3-70b-versatile");
  });

  it("returns null when the provider has no key", async () => {
    const r = await resolveModel("openai:gpt-4o", new Map(), opts());
    assert.equal(r, null);
  });

  it("resolves ollama:<model> without any key", async () => {
    const r = await resolveModel("ollama:llama3", new Map(), opts());
    assert.ok(r);
    assert.equal(r.label, "ollama:llama3");
  });
});

describe("resolveModel (auto)", () => {
  it("prefers local Ollama when present", async () => {
    const r = await resolveModel(
      "auto",
      new Map([["openai", "sk-x"]]),
      opts({ openai: ["gpt-4o-mini"] }, ["llama3:8b"]),
    );
    assert.ok(r);
    assert.equal(r.label, "ollama:llama3:8b");
  });

  it("prefers an explicitly free model across providers", async () => {
    const r = await resolveModel(
      "auto",
      new Map([
        ["openai", "sk-x"],
        ["openrouter", "sk-or-x"],
      ]),
      opts({
        openai: ["gpt-4o-mini", "gpt-4o"],
        openrouter: ["meta-llama/llama-3.1-8b-instruct:free", "openai/gpt-4o"],
      }),
    );
    assert.ok(r);
    assert.equal(r.label, "openrouter:meta-llama/llama-3.1-8b-instruct:free");
  });

  it("falls back to the preferred cheap model when nothing is free", async () => {
    const r = await resolveModel(
      "auto",
      new Map([["openai", "sk-x"]]),
      opts({ openai: ["gpt-4o", "gpt-4o-mini"] }),
    );
    assert.ok(r);
    assert.equal(r.label, "openai:gpt-4o-mini");
  });

  it("never picks a model outside the live list", async () => {
    const r = await resolveModel(
      "auto",
      new Map([["openai", "sk-x"]]),
      opts({ openai: ["some-custom-deployment"] }),
    );
    assert.ok(r);
    assert.equal(r.label, "openai:some-custom-deployment");
  });

  it("returns null with no keys and no Ollama", async () => {
    const r = await resolveModel("auto", new Map(), opts());
    assert.equal(r, null);
  });
});

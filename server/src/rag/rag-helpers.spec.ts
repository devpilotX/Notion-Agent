import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chunkText, cosine } from "./rag.service";

describe("chunkText", () => {
  it("returns nothing for empty or whitespace text", () => {
    assert.deepEqual(chunkText(""), []);
    assert.deepEqual(chunkText("   \n\t  "), []);
  });

  it("keeps short text as a single chunk with collapsed whitespace", () => {
    assert.deepEqual(chunkText("hello   world\n\nagain"), ["hello world again"]);
  });

  it("splits long text into overlapping chunks that cover everything", () => {
    const text = "abcdefghij".repeat(500); // 5000 chars
    const chunks = chunkText(text, 1200, 150);
    assert.ok(chunks.length > 1);
    for (const c of chunks) assert.ok(c.length <= 1200);
    // Overlap: each successive chunk starts 1050 chars later.
    assert.equal(chunks[1].slice(0, 150), chunks[0].slice(1050, 1200));
    // Full coverage: rebuilding from strides matches the original.
    const rebuilt =
      chunks[0] + chunks.slice(1).map((c) => c.slice(150)).join("");
    assert.equal(rebuilt, text);
  });
});

describe("cosine", () => {
  it("is 1 for identical directions and 0 for orthogonal", () => {
    assert.ok(Math.abs(cosine([1, 2, 3], [2, 4, 6]) - 1) < 1e-9);
    assert.equal(cosine([1, 0], [0, 1]), 0);
  });

  it("is -1 for opposite directions", () => {
    assert.ok(Math.abs(cosine([1, 1], [-1, -1]) + 1) < 1e-9);
  });

  it("handles zero vectors and length mismatches safely", () => {
    assert.equal(cosine([0, 0], [1, 2]), 0);
    assert.ok(Math.abs(cosine([1, 2, 999], [1, 2]) - 1) < 1e-9); // extra dims ignored
  });
});

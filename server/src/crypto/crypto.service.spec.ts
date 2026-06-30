import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { CryptoService } from "./crypto.service";

const key = randomBytes(32).toString("base64");

test("encrypt/decrypt round-trips a secret", () => {
  const c = new CryptoService(key);
  const secret = "sk-ant-abc123-XYZ-7Q2a";
  const enc = c.encrypt(secret);
  assert.notEqual(enc, secret);
  assert.ok(enc.startsWith("v1:"));
  assert.equal(c.decrypt(enc), secret);
});

test("ciphertext differs each time (random IV)", () => {
  const c = new CryptoService(key);
  assert.notEqual(c.encrypt("same input"), c.encrypt("same input"));
});

test("decrypt throws on tampered ciphertext", () => {
  const c = new CryptoService(key);
  const enc = c.encrypt("tamper-me");
  const [v, body] = enc.split(":");
  const buf = Buffer.from(body, "base64");
  buf[buf.length - 1] ^= 0x01; // flip one bit
  const tampered = `${v}:${buf.toString("base64")}`;
  assert.throws(() => c.decrypt(tampered));
});

test("a key encrypted by one instance decrypts in another with the same master key", () => {
  const a = new CryptoService(key);
  const b = new CryptoService(key);
  assert.equal(b.decrypt(a.encrypt("portable")), "portable");
});

test("rejects a master key that is not 32 bytes", () => {
  assert.throws(() => new CryptoService("too-short"));
});

test("mask shows only the last 4 characters", () => {
  const masked = CryptoService.mask("sk-1234567890ABCD");
  assert.ok(masked.endsWith("ABCD"));
  assert.ok(!masked.includes("1234567890"));
});

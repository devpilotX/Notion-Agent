import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  readCookie,
  signSession,
  verifyPassword,
  verifySession,
} from "./auth.util";

describe("password hashing", () => {
  it("round-trips a password", () => {
    const stored = hashPassword("correct horse battery staple");
    assert.ok(stored.startsWith("scrypt$"));
    assert.equal(verifyPassword("correct horse battery staple", stored), true);
  });

  it("rejects a wrong password and salts uniquely", () => {
    const a = hashPassword("password-one");
    const b = hashPassword("password-one");
    assert.notEqual(a, b); // random salt
    assert.equal(verifyPassword("password-two", a), false);
  });

  it("rejects malformed stored hashes without throwing", () => {
    assert.equal(verifyPassword("x", "not-a-hash"), false);
    assert.equal(verifyPassword("x", ""), false);
  });
});

describe("session tokens", () => {
  const secret = "test-secret-test-secret-test-secret";

  it("round-trips a user id", () => {
    const token = signSession("user-123", secret);
    assert.equal(verifySession(token, secret), "user-123");
  });

  it("rejects expired tokens", () => {
    const token = signSession("user-123", secret, 1000, Date.now() - 10_000);
    assert.equal(verifySession(token, secret), null);
  });

  it("rejects a tampered payload and a wrong secret", () => {
    const token = signSession("user-123", secret);
    const [v, payload, mac] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "attacker", exp: Date.now() + 1e6 }))
      .toString("base64url");
    assert.equal(verifySession(`${v}.${forged}.${mac}`, secret), null);
    assert.equal(verifySession(token, "another-secret-another-secret!!"), null);
  });

  it("rejects garbage", () => {
    assert.equal(verifySession("", secret), null);
    assert.equal(verifySession("v1.only-two", secret), null);
    assert.equal(verifySession("nonsense", secret), null);
  });
});

describe("readCookie", () => {
  it("finds a cookie among several", () => {
    const header = "a=1; verdant_session=tok%20en; b=2";
    assert.equal(readCookie(header, "verdant_session"), "tok en");
  });

  it("returns null when absent", () => {
    assert.equal(readCookie(undefined, "x"), null);
    assert.equal(readCookie("a=1; b=2", "x"), null);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isUrlAllowed, isPrivateHost } from "./tools";

describe("isPrivateHost", () => {
  const blocked = [
    "localhost",
    "sub.localhost",
    "127.0.0.1",
    "127.9.9.9",
    "0.0.0.0",
    "0.255.1.1",
    "10.0.0.5",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "172.16.0.1",
    "172.31.255.255",
    "100.64.0.1", // CGNAT
    "100.127.255.254",
    "::1",
    "[::1]",
    "::",
    "fd00::1", // unique-local
    "fc00::1",
    "fe80::1", // link-local
    "::ffff:127.0.0.1", // IPv4-mapped loopback
    "::ffff:10.0.0.1",
  ];
  for (const h of blocked) {
    it(`blocks ${h}`, () => assert.equal(isPrivateHost(h), true));
  }

  const allowed = [
    "example.com",
    "api.weather.gov",
    "172.32.0.1", // just outside 172.16/12
    "100.63.0.1", // just outside CGNAT
    "100.128.0.1",
    "11.0.0.1",
    "2606:4700::1111", // public IPv6 (Cloudflare)
    "::ffff:8.8.8.8", // IPv4-mapped public
  ];
  for (const h of allowed) {
    it(`allows ${h}`, () => assert.equal(isPrivateHost(h), false));
  }
});

describe("isUrlAllowed", () => {
  it("blocks non-trusted hosts by default", () => {
    assert.equal(isUrlAllowed("https://example.com/x", ["api.weather.gov"], false).ok, false);
  });

  it("allow-all lifts the trust requirement", () => {
    assert.equal(isUrlAllowed("https://example.com/x", [], true).ok, true);
  });

  it("trusted host and subdomains are allowed", () => {
    assert.equal(isUrlAllowed("https://api.weather.gov/p", ["api.weather.gov"], false).ok, true);
    assert.equal(isUrlAllowed("https://alerts.api.weather.gov", ["api.weather.gov"], false).ok, true);
  });

  it("trusted entries tolerate scheme and path decorations", () => {
    assert.equal(isUrlAllowed("https://example.com/a", ["https://example.com/docs"], false).ok, true);
  });

  it("private hosts stay blocked even with allow-all", () => {
    assert.equal(isUrlAllowed("http://127.0.0.1:5432", [], true).ok, false);
    assert.equal(isUrlAllowed("http://169.254.169.254/latest", [], true).ok, false);
    assert.equal(isUrlAllowed("http://[::1]/admin", [], true).ok, false);
    assert.equal(isUrlAllowed("http://100.64.1.2/", [], true).ok, false);
  });

  it("non-http protocols are blocked", () => {
    assert.equal(isUrlAllowed("file:///etc/passwd", [], true).ok, false);
    assert.equal(isUrlAllowed("ftp://example.com/x", [], true).ok, false);
  });

  it("invalid URLs are blocked", () => {
    assert.equal(isUrlAllowed("not a url", [], true).ok, false);
  });
});

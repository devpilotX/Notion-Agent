import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cronMatches } from "./cron";

// date helper: minute, hour, day-of-month, month(1-12), with a fixed year
const at = (min: number, hr: number, dom = 15, mon = 6) =>
  new Date(2026, mon - 1, dom, hr, min, 0);

describe("cronMatches", () => {
  it("matches * * * * * at any time", () => {
    assert.equal(cronMatches("* * * * *", at(0, 0)), true);
    assert.equal(cronMatches("* * * * *", at(59, 23)), true);
  });

  it("matches exact minute and hour", () => {
    assert.equal(cronMatches("30 9 * * *", at(30, 9)), true);
    assert.equal(cronMatches("30 9 * * *", at(31, 9)), false);
    assert.equal(cronMatches("30 9 * * *", at(30, 10)), false);
  });

  it("supports steps", () => {
    assert.equal(cronMatches("*/5 * * * *", at(0, 12)), true);
    assert.equal(cronMatches("*/5 * * * *", at(10, 12)), true);
    assert.equal(cronMatches("*/5 * * * *", at(7, 12)), false);
  });

  it("supports ranges and stepped ranges", () => {
    assert.equal(cronMatches("10-20 * * * *", at(15, 3)), true);
    assert.equal(cronMatches("10-20 * * * *", at(21, 3)), false);
    assert.equal(cronMatches("10-20/2 * * * *", at(14, 3)), true);
    assert.equal(cronMatches("10-20/2 * * * *", at(15, 3)), false);
  });

  it("supports lists", () => {
    assert.equal(cronMatches("0,15,30,45 * * * *", at(45, 8)), true);
    assert.equal(cronMatches("0,15,30,45 * * * *", at(46, 8)), false);
  });

  it("matches day-of-month and month fields", () => {
    assert.equal(cronMatches("0 0 15 6 *", at(0, 0, 15, 6)), true);
    assert.equal(cronMatches("0 0 15 6 *", at(0, 0, 16, 6)), false);
    assert.equal(cronMatches("0 0 15 7 *", at(0, 0, 15, 6)), false);
  });

  it("matches day-of-week", () => {
    const monday = new Date(2026, 5, 15, 9, 0); // 2026-06-15 is a Monday
    assert.equal(monday.getDay(), 1);
    assert.equal(cronMatches("0 9 * * 1", monday), true);
    assert.equal(cronMatches("0 9 * * 2", monday), false);
  });

  it("rejects malformed expressions", () => {
    assert.equal(cronMatches("* * * *", at(0, 0)), false); // 4 fields
    assert.equal(cronMatches("not a cron", at(0, 0)), false);
    assert.equal(cronMatches("a b c d e", at(0, 0)), false);
  });
});

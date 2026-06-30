/**
 * Minimal 5-field cron matcher: "minute hour day-of-month month day-of-week".
 * Supports *, lists (1,2,3), ranges (1-5), and steps (*\/5, 10-20/2).
 * Enough for the scheduled trigger path without an external dependency.
 */
export function cronMatches(expr: string, date: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [min, hr, dom, mon, dow] = parts;
  return (
    field(min, date.getMinutes(), 0, 59) &&
    field(hr, date.getHours(), 0, 23) &&
    field(dom, date.getDate(), 1, 31) &&
    field(mon, date.getMonth() + 1, 1, 12) &&
    field(dow, date.getDay(), 0, 6)
  );
}

function field(spec: string, value: number, lo: number, hi: number): boolean {
  for (const token of spec.split(",")) {
    const [range, stepStr] = token.split("/");
    const step = stepStr ? parseInt(stepStr, 10) : 1;
    if (Number.isNaN(step) || step < 1) continue;

    let start = lo;
    let end = hi;
    if (range !== "*") {
      const [a, b] = range.split("-");
      start = parseInt(a, 10);
      end = b !== undefined ? parseInt(b, 10) : start;
      if (Number.isNaN(start) || Number.isNaN(end)) continue;
    }
    if (value < start || value > end) continue;
    if ((value - start) % step === 0) return true;
  }
  return false;
}

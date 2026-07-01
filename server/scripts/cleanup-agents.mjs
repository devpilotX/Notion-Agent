import { pgFromEnv } from "./db-env.mjs";

const KEEP = "375e7a25-6bbb-43ef-895e-035f9a01f658"; // the original Fern with the real data
const sql = pgFromEnv();

try {
  const rows = await sql`
    SELECT a.id, a.name, a.created_at,
      (SELECT count(*)::int FROM sessions s WHERE s.agent_id = a.id) AS sessions,
      (SELECT count(*)::int FROM runs r WHERE r.agent_id = a.id) AS runs
    FROM agents a ORDER BY a.created_at`;
  console.log("AGENTS:");
  for (const r of rows) {
    console.log(`  ${r.id} | ${r.name} | sessions=${r.sessions} runs=${r.runs}${r.id === KEEP ? "  <- keep" : ""}`);
  }

  // Remove only stray agents: not the original, and with no sessions and no runs.
  const strays = rows.filter((r) => r.id !== KEEP && r.sessions === 0 && r.runs === 0);
  for (const s of strays) {
    await sql`DELETE FROM agents WHERE id = ${s.id}`;
    console.log("deleted stray:", s.id, s.name);
  }
  const after = await sql`SELECT count(*)::int AS n FROM agents`;
  console.log("agents remaining:", after[0].n);
} finally {
  await sql.end({ timeout: 5 });
}

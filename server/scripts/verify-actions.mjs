import { pgFromEnv } from "./db-env.mjs";

const BASE = process.env.BASE ?? "http://localhost:4000";
const J = async (r) => ({ status: r.status, body: await r.json().catch(() => null) });
const get = (p) => fetch(`${BASE}${p}`).then(J);
const post = (p) => fetch(`${BASE}${p}`, { method: "POST" }).then(J);
const patch = (p, b) =>
  fetch(`${BASE}${p}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(b),
  }).then(J);
const del = (p) => fetch(`${BASE}${p}`, { method: "DELETE" }).then(J);

const sql = pgFromEnv();

const agentsCount = async () => (await sql`SELECT count(*)::int AS n FROM agents`)[0].n;
const favOf = async (id) =>
  (await sql`SELECT favorite FROM agents WHERE id = ${id}`)[0]?.favorite;

try {
  const cur = await get("/agents/current");
  const A = cur.body.id;
  const startCount = await agentsCount();
  console.log("current agent:", A, "| agents in db:", startCount);

  // FAVORITE (reversible, on the real agent)
  await patch(`/agents/${A}`, { favorite: true });
  console.log("favorite=true  -> db:", await favOf(A));
  await patch(`/agents/${A}`, { favorite: false });
  console.log("favorite=false -> db:", await favOf(A));

  // EXPORT
  const exp = await get(`/agents/${A}/export`);
  console.log("export ok:", exp.status === 200, "| has settings:", !!exp.body?.settings);

  // DUPLICATE (creates throwaway B)
  const dup = await post(`/agents/${A}/duplicate`);
  const B = dup.body.id;
  console.log("duplicate -> B:", B, "| name:", dup.body.name, "| count:", await agentsCount());

  // RESET B
  const r = await post(`/agents/${B}/reset`);
  console.log("reset B name:", r.body.name);
  const ver = await sql`SELECT count(*)::int AS n FROM agent_versions WHERE agent_id = ${B}`;
  console.log("B agent_versions rows:", ver[0].n);

  // DELETE B (throwaway, leaves the real agent + its data intact)
  const d = await del(`/agents/${B}`);
  const endCount = await agentsCount();
  console.log("delete B:", d.body?.deleted, "| count back to start:", endCount === startCount);

  console.log(
    "RESULT:",
    endCount === startCount && exp.status === 200 ? "PASS" : "CHECK",
  );
} catch (e) {
  console.error("VERIFY ERROR:", e.message);
} finally {
  await sql.end({ timeout: 5 });
}

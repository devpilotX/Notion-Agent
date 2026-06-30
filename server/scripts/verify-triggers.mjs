import postgres from "postgres";

const BASE = process.env.BASE ?? "http://localhost:4000";
const J = async (r) => ({ status: r.status, body: await r.json().catch(() => null) });
const post = (p, b) =>
  fetch(`${BASE}${p}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: b ? JSON.stringify(b) : undefined,
  }).then(J);
const del = (p) => fetch(`${BASE}${p}`, { method: "DELETE" }).then(J);

const sql = postgres({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

const runCount = async (id) =>
  (await sql`SELECT count(*)::int AS n FROM runs WHERE trigger_id = ${id}`)[0].n;

try {
  // 1. Scheduled trigger that fires every 3 seconds.
  const sched = await post("/triggers", {
    type: "scheduled",
    config: { intervalSec: 3, message: "Reply with the single word: OK." },
  });
  console.log("CREATE scheduled:", sched.status, "id:", sched.body?.id, "type:", sched.body?.type);
  const schedId = sched.body.id;
  const dbRow = await sql`SELECT type, enabled, config_json FROM triggers WHERE id = ${schedId}`;
  console.log("DB persisted:", JSON.stringify(dbRow[0]));

  console.log("waiting 8s for scheduled fires...");
  await new Promise((r) => setTimeout(r, 8000));
  const n1 = await runCount(schedId);
  console.log("RUNS fired by scheduled trigger:", n1, n1 >= 1 ? "PASS" : "FAIL");

  // 2. Webhook trigger fired by token.
  const hook = await post("/triggers", {
    type: "webhook",
    config: { message: "Reply with the single word: HOOK." },
  });
  const token = hook.body?.config?.token;
  console.log("CREATE webhook:", hook.status, "token:", token);
  const fired = await post(`/triggers/webhook/${token}`, { message: "Reply OK." });
  console.log("WEBHOOK fire:", fired.status, "runId:", fired.body?.runId);
  const n2 = await runCount(hook.body.id);
  console.log("RUNS fired by webhook trigger:", n2, n2 >= 1 ? "PASS" : "FAIL");

  // 3. List shows both.
  const list = await fetch(`${BASE}/triggers`).then(J);
  console.log("LIST count:", Array.isArray(list.body) ? list.body.length : "n/a");

  // 4. Cleanup so the scheduled trigger stops firing.
  await del(`/triggers/${schedId}`);
  await del(`/triggers/${hook.body.id}`);
  const after = await fetch(`${BASE}/triggers`).then(J);
  console.log("LIST after cleanup:", Array.isArray(after.body) ? after.body.length : "n/a");
} catch (e) {
  console.error("VERIFY ERROR:", e.message);
} finally {
  await sql.end({ timeout: 5 });
}

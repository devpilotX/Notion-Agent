import postgres from "postgres";

const BASE = process.env.BASE ?? "http://localhost:4099";

async function drainRun(message) {
  const res = await fetch(`${BASE}/agents/default/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let sessionId = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      for (const line of frame.split("\n")) {
        if (line.startsWith("data:")) {
          const e = JSON.parse(line.slice(5).trim());
          if (e.type === "run.start") sessionId = e.sessionId;
        }
      }
    }
  }
  return sessionId;
}

console.log("--- run a message (creates a session with content) ---");
const sidA = await drainRun("Say hello in three words.");
console.log("RUN_SESSION:", sidA);

console.log("--- create an empty session (New session) ---");
const created = await (await fetch(`${BASE}/sessions`, { method: "POST" })).json();
console.log("NEW_SESSION:", created.id, "| title:", created.title, "| count:", created.messageCount);

console.log("--- list sessions (newest first) ---");
const list = await (await fetch(`${BASE}/sessions`)).json();
console.log("LIST_COUNT:", list.length);
list.slice(0, 5).forEach((s, i) =>
  console.log(`  [${i}] ${s.id.slice(0, 8)} | "${s.title}" | msgs:${s.messageCount}`),
);
console.log("NEWEST_IS_NEW_SESSION:", list[0]?.id === created.id);

console.log("--- load messages for the run session ---");
const msgs = await (await fetch(`${BASE}/sessions/${sidA}/messages`)).json();
console.log("MESSAGES_COUNT:", msgs.length);
msgs.forEach((m) => console.log(`  ${m.role}: ${String(m.content).slice(0, 40)}`));

const sql = postgres({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});
try {
  const rows = await sql`SELECT id, title, created_at FROM sessions ORDER BY created_at DESC LIMIT 5`;
  console.log("DB newest sessions:");
  rows.forEach((r) =>
    console.log(`  ${r.id.slice(0, 8)} | ${r.title ?? "(null)"} | ${r.created_at.toISOString()}`),
  );
  const c = await sql`SELECT count(*)::int AS n FROM sessions`;
  console.log("DB total sessions:", c[0].n);
} finally {
  await sql.end({ timeout: 5 });
}

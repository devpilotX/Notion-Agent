import postgres from "postgres";

const BASE = process.env.BASE ?? "http://localhost:4099";

const before = await (await fetch(`${BASE}/usage`)).json();
console.log("USAGE_BEFORE:", JSON.stringify(before));

async function run(message) {
  const res = await fetch(`${BASE}/agents/default/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let runTokens = 0;
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
          if (e.type === "usage") runTokens = e.tokens;
        }
      }
    }
  }
  return runTokens;
}

const used = await run("In one sentence, name a tree.");
console.log("RUN_USAGE_TOKENS:", used);

const after = await (await fetch(`${BASE}/usage`)).json();
console.log("USAGE_AFTER:", JSON.stringify(after));
console.log("DELTA:", after.tokens - before.tokens, "expected", used);

const sql = postgres({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});
try {
  const [r] = await sql`SELECT coalesce(sum(tokens),0)::int AS tokens, count(*)::int AS runs FROM runs`;
  console.log("DB runs sum tokens:", r.tokens, "| run rows:", r.runs);
  console.log("MATCHES_API:", r.tokens === after.tokens);
} finally {
  await sql.end({ timeout: 5 });
}

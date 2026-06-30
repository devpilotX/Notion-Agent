import postgres from "postgres";

const BASE = process.env.BASE ?? "http://localhost:4099";
const j = async (r) => r.json();

const a = await j(await fetch(`${BASE}/agents/current`));
console.log("NAME_BEFORE:", a.name);

const base = {
  description: a.description ?? "",
  instructions: a.instructions ?? "",
  modelMode: a.modelMode,
  modelId: a.modelId ?? null,
  settings: a.settings,
};

await fetch(`${BASE}/agents/${a.id}/save`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ...base, name: "Verdant Tester" }),
});

const after = await j(await fetch(`${BASE}/agents/current`));
console.log("NAME_AFTER_RELOAD:", after.name);

const sql = postgres({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});
try {
  const [row] = await sql`SELECT name FROM agents WHERE id = ${a.id}`;
  console.log("DB_NAME:", row.name);
} finally {
  await sql.end({ timeout: 5 });
}

await fetch(`${BASE}/agents/${a.id}/save`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ...base, name: "Fern" }),
});
console.log("RESTORED_NAME: Fern");

const h = await fetch(`${BASE}/health`);
console.log("HEALTH_WHILE_UP:", h.status, (await h.json()).status);

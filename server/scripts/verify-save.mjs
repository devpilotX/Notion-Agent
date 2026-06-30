import postgres from "postgres";

const BASE = process.env.BASE ?? "http://localhost:4099";
const json = async (r) => await r.json();

const before = await json(await fetch(`${BASE}/agents/current`));
console.log("BEFORE:", before.name, "| model:", before.modelMode, before.modelId ?? "");

const testPayload = {
  name: "Fern Verified",
  description: "Saved by the verification run.",
  instructions: "You are Fern. Keep replies short.",
  modelMode: "manual",
  modelId: "groq:llama-3.3-70b-versatile",
  settings: {
    triggers: { run: true, newChat: false, mention: true },
    webAccess: false,
    trustedUrls: ["example.com", "docs.agentforge.dev"],
    allowAllUrls: true,
  },
};
await fetch(`${BASE}/agents/${before.id}/save`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(testPayload),
});

const after = await json(await fetch(`${BASE}/agents/current`));
console.log("RELOAD name:", after.name, "| desc:", after.description);
console.log("RELOAD model:", after.modelMode, after.modelId);
console.log("RELOAD settings:", JSON.stringify(after.settings));

const sql = postgres({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});
try {
  const rows = await sql`SELECT name, model_mode, model_id, settings_json FROM agents WHERE id = ${before.id}`;
  console.log("DB agents row:", JSON.stringify(rows[0]));
  const v1 = await sql`SELECT count(*)::int AS n FROM agent_versions WHERE agent_id = ${before.id}`;
  console.log("DB agent_versions count after save:", v1[0].n);
  const last = await sql`SELECT config_json FROM agent_versions WHERE agent_id = ${before.id} ORDER BY created_at DESC LIMIT 1`;
  console.log("DB latest version name:", last[0]?.config_json?.name);

  // restore sensible defaults so the agent is left clean
  const restore = {
    name: "Fern",
    description: "",
    instructions: "You are Fern, a calm and helpful agent. Answer clearly and concisely.",
    modelMode: "auto",
    modelId: null,
    settings: {
      triggers: { run: true, newChat: true, mention: false },
      webAccess: true,
      trustedUrls: ["docs.agentforge.dev", "api.weather.gov"],
      allowAllUrls: false,
    },
  };
  await fetch(`${BASE}/agents/${before.id}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(restore),
  });
  const v2 = await sql`SELECT count(*)::int AS n FROM agent_versions WHERE agent_id = ${before.id}`;
  console.log("DB agent_versions count after restore:", v2[0].n);
} finally {
  await sql.end({ timeout: 5 });
}

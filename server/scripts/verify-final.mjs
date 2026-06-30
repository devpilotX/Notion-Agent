import postgres from "postgres";

const BASE = process.env.BASE ?? "http://localhost:4000";
const sql = postgres({
  host: process.env.PGHOST, port: Number(process.env.PGPORT),
  user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE,
});
const get = async (p) => await (await fetch(`${BASE}${p}`)).json();
const post = (p, b) => fetch(`${BASE}${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: b ? JSON.stringify(b) : undefined });

async function run(message) {
  const res = await post(`/agents/default/run`, { message });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", reply = "";
  const labels = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, i); buf = buf.slice(i + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const e = JSON.parse(line.slice(5).trim());
        if (e.type === "message.delta") reply += e.text;
        if (e.type === "step.start") labels.push(e.label);
      }
    }
  }
  return { reply, labels };
}

const pass = (name, ok) => console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);

try {
  const orig = await get("/agents/current");
  const id = orig.id;
  const origPayload = {
    name: orig.name, description: orig.description ?? "", instructions: orig.instructions ?? "",
    modelMode: orig.modelMode, modelId: orig.modelId ?? null, settings: orig.settings,
  };
  const verBefore = (await sql`SELECT count(*)::int n FROM agent_versions WHERE agent_id=${id}`)[0].n;
  const usageBefore = (await get("/usage")).tokens;
  const sessBefore = (await get("/sessions")).length;

  // SAVE a test config (name, instructions, manual model, trusted urls, toggles).
  await post(`/agents/${id}/save`, {
    name: "Fern",
    description: "verification",
    instructions: "Begin every reply with the word ACORN in capitals.",
    modelMode: "manual",
    modelId: "groq:llama-3.3-70b-versatile",
    settings: { triggers: { run: true, newChat: true, mention: false }, webAccess: true, trustedUrls: ["api.weather.gov"], allowAllUrls: false },
  });
  const after = await get("/agents/current");
  pass("save persists instructions + model + trusted urls",
    after.instructions.includes("ACORN") && after.modelId === "groq:llama-3.3-70b-versatile" && after.settings.trustedUrls.includes("api.weather.gov"));
  const dbRow = (await sql`SELECT model_id, settings_json FROM agents WHERE id=${id}`)[0];
  pass("DB agents row reflects save", dbRow.model_id === "groq:llama-3.3-70b-versatile");
  const verAfter = (await sql`SELECT count(*)::int n FROM agent_versions WHERE agent_id=${id}`)[0].n;
  pass("agent_versions row written", verAfter === verBefore + 1);

  // RUN: instructions reach the model + chosen model is used.
  const { reply, labels } = await run("Say hello in three words.");
  pass("instructions reach the model (reply starts with ACORN)", /ACORN/i.test(reply));
  pass("chosen model used (groq:llama-3.3-70b-versatile)", labels.some((l) => l.includes("groq:llama-3.3-70b-versatile")));
  console.log("   reply:", reply.slice(0, 80));

  // SESSIONS + USAGE.
  await post(`/sessions`);
  const sessAfter = (await get("/sessions")).length;
  pass("new session increments list", sessAfter >= sessBefore + 1);
  const usageAfter = (await get("/usage")).tokens;
  pass("usage tokens increased after run", usageAfter > usageBefore);

  // RESTORE original config.
  await post(`/agents/${id}/save`, origPayload);
  const restored = await get("/agents/current");
  pass("original config restored", restored.modelMode === orig.modelMode);
} catch (e) {
  console.error("VERIFY ERROR:", e.message);
} finally {
  await sql.end({ timeout: 5 });
}

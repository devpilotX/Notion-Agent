import postgres from "postgres";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE ?? "http://localhost:4000";
const J = async (r) => ({ status: r.status, body: await r.json().catch(() => null) });
const serverPath = fileURLToPath(new URL("./mcp-demo-server.mjs", import.meta.url));

const sql = postgres({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

async function runQuery(message) {
  const res = await fetch(`${BASE}/agents/default/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, model: "groq:llama-3.3-70b-versatile" }),
  });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let reply = "";
  const tools = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const e = JSON.parse(line.slice(5).trim());
        if (e.type === "message.delta") reply += e.text;
        if (e.type === "tool.call") tools.push(e.name);
      }
    }
  }
  return { reply, tools };
}

try {
  // 1. Add a real MCP connection (spawns the demo stdio server).
  const created = await J(
    await fetch(`${BASE}/connections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Demo", transport: "stdio", command: "node", args: [serverPath] }),
    }),
  );
  console.log("CONNECT:", created.status, "status:", created.body?.status, "tools:", JSON.stringify(created.body?.config?.tools));
  const id = created.body?.id;

  // 2. DB row check.
  const row = await sql`SELECT kind, status, config_json FROM connections WHERE id = ${id}`;
  console.log("DB connection:", JSON.stringify(row[0]));

  // 3. A run that must call the MCP tool (the code cannot be guessed).
  const { reply, tools } = await runQuery(
    "You have a tool named get_verdant_code. Call it now and reply with the exact code it returns.",
  );
  console.log("TOOLS CALLED:", tools.join(", ") || "(none)");
  console.log("REPLY:", reply.slice(0, 160));
  console.log(
    "MCP TOOL CALL PASS:",
    tools.includes("get_verdant_code") && /VRD-QUILL-4731/.test(reply) ? "PASS" : "CHECK",
  );

  // 4. A failing connection should report status error, not a silent success.
  const bad = await J(
    await fetch(`${BASE}/connections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Broken", transport: "stdio", command: "node", args: ["does-not-exist-12345.mjs"] }),
    }),
  );
  console.log("FAILED CONNECT status:", bad.body?.status, bad.body?.status === "error" ? "PASS (clear error)" : "CHECK");
  if (bad.body?.id) await fetch(`${BASE}/connections/${bad.body.id}`, { method: "DELETE" });

  // 5. Cleanup the demo connection.
  const del = await J(await fetch(`${BASE}/connections/${id}`, { method: "DELETE" }));
  console.log("DELETE:", del.status, JSON.stringify(del.body));
} catch (e) {
  console.error("VERIFY ERROR:", e.message);
} finally {
  await sql.end({ timeout: 5 });
}

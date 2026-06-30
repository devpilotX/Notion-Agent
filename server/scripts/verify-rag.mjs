import postgres from "postgres";

const BASE = process.env.BASE ?? "http://localhost:4000";
const sql = postgres({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

const FACT =
  "The Verdant project's secret mascot is a luminous axolotl named Quill who guards the canopy archive.";
const SOURCE = "verdant-secret.txt";

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
  const steps = [];
  const events = [];
  let errorMsg = "";
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
        events.push(e.type);
        if (e.type === "message.delta") reply += e.text;
        if (e.type === "step.start") steps.push(e.label);
        if (e.type === "error") errorMsg = e.message;
      }
    }
  }
  console.log("EVENTS:", events.join(" "));
  if (errorMsg) console.log("ERROR EVENT:", errorMsg);
  return { reply, steps };
}

try {
  const agent = await (await fetch(`${BASE}/agents/current`)).json();

  // 1. Upload a text document via multipart.
  const fd = new FormData();
  fd.append("files", new Blob([FACT], { type: "text/plain" }), SOURCE);
  const up = await fetch(`${BASE}/documents/upload`, { method: "POST", body: fd });
  const upBody = await up.json();
  console.log("UPLOAD:", up.status, JSON.stringify(upBody));

  // 2. DB: rows + embedding dimensions.
  const rows = await sql`SELECT chunk, array_length(embedding,1) AS dim FROM documents WHERE source = ${SOURCE}`;
  console.log("DB rows:", rows.length, "| embedding dim:", rows[0]?.dim);

  // 3. List sources via API.
  const list = await (await fetch(`${BASE}/documents`)).json();
  console.log("LIST:", JSON.stringify(list));

  // 4. Grounded query.
  const { reply, steps } = await runQuery(
    "According to my uploaded documents, what is the secret mascot of the Verdant project and what is its name?",
  );
  const grounded = /quill/i.test(reply) && /axolotl/i.test(reply);
  console.log("STEPS:", steps.join(" | "));
  console.log("REPLY:", reply.slice(0, 240));
  console.log("GROUNDED (mentions Quill + axolotl):", grounded ? "PASS" : "FAIL");

  // 5. Cleanup.
  const del = await fetch(`${BASE}/documents/${encodeURIComponent(SOURCE)}`, { method: "DELETE" });
  console.log("DELETE:", del.status, JSON.stringify(await del.json()));
} catch (e) {
  console.error("VERIFY ERROR:", e.message);
} finally {
  await sql.end({ timeout: 5 });
}

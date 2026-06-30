import postgres from "postgres";
import { createGroq } from "@ai-sdk/groq";
import { streamText, stepCountIs } from "ai";
const { CryptoService } = await import("../dist/crypto/crypto.service.js");
const { buildWebTools } = await import("../dist/runtime/tools.js");

const crypto = new CryptoService(process.env.MASTER_ENCRYPTION_KEY);
const sql = postgres({
  host: process.env.PGHOST, port: Number(process.env.PGPORT),
  user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE,
});

try {
  const row = await sql`SELECT secret_encrypted FROM api_keys WHERE provider='groq' LIMIT 1`;
  const key = crypto.decrypt(row[0].secret_encrypted);
  const model = createGroq({ apiKey: key })("llama-3.3-70b-versatile");
  const tools = buildWebTools({ webAccess: true, trustedUrls: ["api.weather.gov"], allowAllUrls: false });
  console.log("tool keys:", Object.keys(tools).join(", "));

  const result = streamText({
    model,
    system: "You are helpful.",
    messages: [{ role: "user", content: "Use web_fetch to fetch https://api.weather.gov and summarize in one sentence." }],
    tools,
    stopWhen: stepCountIs(6),
  });
  for await (const part of result.fullStream) {
    if (part.type === "error") {
      console.log("ERROR PART:", JSON.stringify(part.error, Object.getOwnPropertyNames(part.error ?? {})).slice(0, 800));
    } else {
      console.log("part:", part.type, part.type === "tool-call" ? part.toolName : "");
    }
  }
} catch (e) {
  console.error("THROWN:", e?.message ?? e);
  if (e?.cause) console.error("CAUSE:", JSON.stringify(e.cause).slice(0, 600));
} finally {
  await sql.end({ timeout: 5 });
}

// Verifies the remote (HTTP) MCP connect path with a bearer token, no engine.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const serverPath = fileURLToPath(new URL("./mcp-demo-http-server.mjs", import.meta.url));
const PORT = 4577;
const TOKEN = "verdant-demo-token";
const URL_ = `http://localhost:${PORT}/mcp`;

const child = spawn("node", [serverPath], {
  env: { ...process.env, MCP_PORT: String(PORT), MCP_TOKEN: TOKEN },
  stdio: ["ignore", "pipe", "pipe"],
});

await new Promise((resolve) => {
  child.stdout.on("data", (d) => { if (String(d).includes("http mcp demo on")) resolve(); });
  setTimeout(resolve, 2500);
});

async function connect(token) {
  const client = new Client({ name: "verdant-test", version: "1.0.0" }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(URL_), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  return client;
}

try {
  // Correct token: tools appear and a tool call works.
  const client = await connect(TOKEN);
  const { tools } = await client.listTools();
  console.log("remote tools:", tools.map((t) => t.name).join(", "));
  const r = await client.callTool({ name: "ping", arguments: {} });
  const text = r.content?.map((c) => c.text).join("") ?? "";
  console.log("ping ->", text);
  await client.close();
  const okGood = tools.some((t) => t.name === "ping") && text.trim() === "pong";

  // Wrong token: connect must fail (401).
  let okBad = false;
  try {
    const bad = await connect("wrong-token");
    await bad.close();
  } catch {
    okBad = true;
  }

  console.log("RESULT good-token:", okGood ? "PASS" : "FAIL");
  console.log("RESULT bad-token rejected:", okBad ? "PASS" : "FAIL");
} catch (e) {
  console.error("REMOTE MCP ERROR:", e.message);
} finally {
  child.kill();
}

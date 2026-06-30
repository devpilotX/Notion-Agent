// Verifies the MCP client + demo server handshake without the engine.
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = fileURLToPath(new URL("./mcp-demo-server.mjs", import.meta.url));

const transport = new StdioClientTransport({ command: "node", args: [serverPath] });
const client = new Client({ name: "verdant-test", version: "1.0.0" }, { capabilities: {} });

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  console.log("TOOLS:", tools.map((t) => t.name).join(", "));

  const result = await client.callTool({ name: "sum", arguments: { a: 21, b: 21 } });
  const text = result.content?.map((c) => c.text).join("") ?? "";
  console.log("sum(21,21) =", text);
  console.log("RESULT:", tools.some((t) => t.name === "sum") && text.trim() === "42" ? "PASS" : "FAIL");
} catch (e) {
  console.error("MCP ERROR:", e.message);
} finally {
  await client.close().catch(() => {});
}

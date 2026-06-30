// Verifies the Filesystem preset by connecting to the real reference server
// over stdio (npx @modelcontextprotocol/server-filesystem), no engine needed.
import os from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const dir = os.tmpdir();
const transport = new StdioClientTransport({
  command: process.platform === "win32" ? "npx.cmd" : "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", dir],
});
const client = new Client({ name: "verdant-test", version: "1.0.0" }, { capabilities: {} });

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  console.log("filesystem tools:", names.join(", "));
  console.log("RESULT:", names.includes("list_directory") || names.includes("read_file") ? "PASS" : "CHECK");
} catch (e) {
  console.error("FILESYSTEM PRESET ERROR:", e.message);
} finally {
  await client.close().catch(() => {});
}

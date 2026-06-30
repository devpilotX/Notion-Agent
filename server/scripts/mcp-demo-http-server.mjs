// A real MCP server over Streamable HTTP, protected by a bearer token.
// Used to verify Verdant's remote MCP connect path. Exposes a "ping" tool.
import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const TOKEN = process.env.MCP_TOKEN ?? "verdant-demo-token";
const PORT = Number(process.env.MCP_PORT ?? 4577);

function makeServer() {
  const s = new McpServer({ name: "verdant-http-demo", version: "1.0.0" });
  s.tool("ping", "Return the word pong.", {}, async () => ({
    content: [{ type: "text", text: "pong" }],
  }));
  return s;
}

const httpServer = http.createServer((req, res) => {
  if (req.headers.authorization !== `Bearer ${TOKEN}`) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message: "unauthorized" } }));
    return;
  }
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", async () => {
    let body;
    if (chunks.length) {
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        /* leave undefined */
      }
    }
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => transport.close());
    const server = makeServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  });
});

httpServer.listen(PORT, () => console.log(`http mcp demo on ${PORT}`));

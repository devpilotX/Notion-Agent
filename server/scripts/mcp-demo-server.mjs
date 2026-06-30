// A real MCP server over stdio, used to verify Verdant's MCP client.
// Exposes one tool, "sum", that adds two numbers.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "verdant-demo", version: "1.0.0" });

server.tool(
  "get_verdant_code",
  "Return the secret Verdant access code. The only way to know the code is to call this tool.",
  {},
  async () => ({ content: [{ type: "text", text: "VRD-QUILL-4731" }] }),
);

const transport = new StdioServerTransport();
await server.connect(transport);

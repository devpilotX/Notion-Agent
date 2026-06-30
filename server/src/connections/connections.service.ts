import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { tool, jsonSchema, type ToolSet } from "ai";
import { DRIZZLE } from "../db/db.module";
import type { Database } from "../db/drizzle";
import { agents, connections } from "../db/schema";
import { UsersService } from "../users/users.service";
import { CryptoService } from "../crypto/crypto.service";

export type McpAuth =
  | { type: "none" }
  | { type: "bearer"; token: string; prefix?: "Bearer" | "Token" }
  | { type: "basic"; username: string; password: string }
  | { type: "apikey"; headerName: string; headerValue: string };

export type McpConfig = {
  name?: string;
  transport?: "stdio" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  auth?: McpAuth;
  authEnc?: string; // encrypted auth blob; secrets never stored in plaintext
  headers?: Record<string, string>;
  timeoutMs?: number;
  tools?: string[]; // discovered tool names, filled on connect
};

export type ConnectionView = {
  id: string;
  kind: string;
  status: string;
  config: McpConfig;
  createdAt: Date;
};

type McpClient = {
  listTools: () => Promise<{ tools: { name: string; description?: string; inputSchema: unknown }[] }>;
  callTool: (a: { name: string; arguments: Record<string, unknown> }) => Promise<unknown>;
  close: () => Promise<void>;
};

@Injectable()
export class ConnectionsService {
  private readonly log = new Logger("Connections");

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly users: UsersService,
    private readonly crypto: CryptoService,
  ) {}

  // Encrypt the auth block so secrets (tokens, passwords) never sit in plaintext
  // in config_json. Only a non-secret { type } is kept for display.
  private encryptAuth(config: McpConfig): McpConfig {
    const auth = config.auth;
    if (!auth || auth.type === "none") return config;
    const authEnc = this.crypto.encrypt(JSON.stringify(auth));
    return { ...config, auth: { type: auth.type } as McpAuth, authEnc };
  }

  private decryptAuth(config: McpConfig): McpConfig {
    if (!config.authEnc) return config;
    try {
      const auth = JSON.parse(this.crypto.decrypt(config.authEnc)) as McpAuth;
      return { ...config, auth };
    } catch {
      return config;
    }
  }

  private async agentId(userId: string): Promise<string> {
    const rows = await this.db
      .select({ id: agents.id })
      .from(agents)
      .where(eq(agents.userId, userId))
      .orderBy(agents.createdAt)
      .limit(1);
    return rows[0]?.id;
  }

  private toView(r: typeof connections.$inferSelect): ConnectionView {
    const raw = (r.configJson as McpConfig) ?? {};
    // Never expose the encrypted blob or any secret in a response.
    const { authEnc: _authEnc, ...rest } = raw;
    const config: McpConfig = {
      ...rest,
      auth: rest.auth ? ({ type: rest.auth.type } as McpAuth) : undefined,
    };
    return {
      id: r.id,
      kind: r.kind,
      status: r.status,
      config,
      createdAt: r.createdAt,
    };
  }

  async list(): Promise<ConnectionView[]> {
    const userId = await this.users.getCurrentUserId();
    const agentId = await this.agentId(userId);
    const rows = await this.db
      .select()
      .from(connections)
      .where(eq(connections.agentId, agentId))
      .orderBy(desc(connections.createdAt));
    return rows.map((r) => this.toView(r));
  }

  /** Create an MCP connection, connect once to discover tools, store status. */
  async create(config: McpConfig): Promise<ConnectionView> {
    const userId = await this.users.getCurrentUserId();
    const agentId = await this.agentId(userId);

    let status = "disconnected";
    let toolNames: string[] = [];
    let client: McpClient | null = null;
    try {
      client = await this.connect(config);
      const { tools } = await client.listTools();
      toolNames = tools.map((t) => t.name);
      status = "connected";
    } catch (e) {
      status = "error";
      this.log.warn(`MCP connect failed: ${(e as Error).message}`);
    } finally {
      await client?.close().catch(() => {});
    }

    const [row] = await this.db
      .insert(connections)
      .values({
        agentId,
        kind: "mcp",
        configJson: { ...this.encryptAuth(config), tools: toolNames },
        status,
      })
      .returning();
    return this.toView(row);
  }

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const res = await this.db
      .delete(connections)
      .where(eq(connections.id, id))
      .returning({ id: connections.id });
    if (!res.length) throw new NotFoundException("Connection not found");
    return { id, deleted: true };
  }

  /** Re-test a connection and refresh its tool list and status. */
  async test(id: string): Promise<ConnectionView> {
    const [row] = await this.db.select().from(connections).where(eq(connections.id, id)).limit(1);
    if (!row) throw new NotFoundException("Connection not found");
    const config = (row.configJson as McpConfig) ?? {};
    let status = "error";
    let toolNames: string[] = config.tools ?? [];
    let client: McpClient | null = null;
    try {
      client = await this.connect(config);
      const { tools } = await client.listTools();
      toolNames = tools.map((t) => t.name);
      status = "connected";
    } catch (e) {
      this.log.warn(`MCP test failed: ${(e as Error).message}`);
    } finally {
      await client?.close().catch(() => {});
    }
    const [updated] = await this.db
      .update(connections)
      .set({
        status,
        configJson: {
          ...this.encryptAuth(this.decryptAuth(config)),
          tools: toolNames,
        },
      })
      .where(eq(connections.id, id))
      .returning();
    return this.toView(updated);
  }

  /**
   * Open every connected MCP server for an agent and return their tools as an
   * AI SDK ToolSet, plus closers to shut the clients down after the run.
   */
  async openMcpToolsets(
    agentId: string,
  ): Promise<{ tools: ToolSet; closers: (() => Promise<void>)[] }> {
    const rows = await this.db
      .select()
      .from(connections)
      .where(eq(connections.agentId, agentId));
    const tools: ToolSet = {};
    const closers: (() => Promise<void>)[] = [];
    const perConnection: Array<Array<[string, ToolSet[string]]>> = [];

    for (const row of rows) {
      if (row.kind !== "mcp" || row.status !== "connected") continue;
      const config = (row.configJson as McpConfig) ?? {};
      try {
        const client = await this.connect(config);
        closers.push(() => client.close().catch(() => {}));
        const { tools: mcpTools } = await client.listTools();
        const built: Array<[string, ToolSet[string]]> = [];
        for (const t of mcpTools) {
          built.push([
            t.name,
            tool({
              description: t.description ?? `MCP tool ${t.name}`,
              inputSchema: jsonSchema(
                (t.inputSchema as object) ?? { type: "object", properties: {} },
              ),
              execute: async (args: unknown) => {
                const result = await client.callTool({
                  name: t.name,
                  arguments: (args ?? {}) as Record<string, unknown>,
                });
                return mcpResultToText(result);
              },
            }),
          ]);
        }
        perConnection.push(built);
      } catch (e) {
        this.log.warn(`MCP open failed for ${row.id}: ${(e as Error).message}`);
      }
    }

    // Round-robin across connections so one large server (GitHub has 40+)
    // does not crowd every other server out of the runtime tool cap.
    const maxLen = perConnection.reduce((n, l) => Math.max(n, l.length), 0);
    for (let i = 0; i < maxLen; i++) {
      for (const list of perConnection) {
        if (i < list.length) {
          const [name, def] = list[i];
          if (!(name in tools)) tools[name] = def;
        }
      }
    }
    return { tools, closers };
  }

  /** Connect a real MCP client over stdio or HTTP (streamable, falling back to SSE). */
  private async connect(rawConfig: McpConfig): Promise<McpClient> {
    const config = this.decryptAuth(rawConfig);
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const client = new Client(
      { name: "verdant-engine", version: "1.0.0" },
      { capabilities: {} },
    );

    if (config.transport === "http") {
      if (!config.url) throw new Error("remote connection needs a URL");
      const url = new URL(config.url);
      const headers = buildHeaders(config);
      const requestInit = Object.keys(headers).length ? { headers } : undefined;

      // Prefer Streamable HTTP; fall back to SSE for older servers.
      try {
        const { StreamableHTTPClientTransport } = await import(
          "@modelcontextprotocol/sdk/client/streamableHttp.js"
        );
        const transport = new StreamableHTTPClientTransport(url, { requestInit });
        await client.connect(transport as never);
        return client as unknown as McpClient;
      } catch {
        const { SSEClientTransport } = await import(
          "@modelcontextprotocol/sdk/client/sse.js"
        );
        const transport = new SSEClientTransport(url, { requestInit });
        await client.connect(transport as never);
        return client as unknown as McpClient;
      }
    }

    if (!config.command) throw new Error("local connection needs a command");
    const { StdioClientTransport } = await import(
      "@modelcontextprotocol/sdk/client/stdio.js"
    );
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args ?? [],
      env: { ...process.env, ...(config.env ?? {}) } as Record<string, string>,
    });
    await client.connect(transport as never);
    return client as unknown as McpClient;
  }
}

export function buildHeaders(config: McpConfig): Record<string, string> {
  const headers: Record<string, string> = { ...(config.headers ?? {}) };
  const auth = config.auth;
  if (auth && auth.type === "bearer" && auth.token) {
    headers["Authorization"] = `${auth.prefix ?? "Bearer"} ${auth.token}`;
  } else if (auth && auth.type === "basic" && auth.username) {
    const encoded = Buffer.from(`${auth.username}:${auth.password ?? ""}`).toString("base64");
    headers["Authorization"] = `Basic ${encoded}`;
  } else if (auth && auth.type === "apikey" && auth.headerName) {
    headers[auth.headerName] = auth.headerValue ?? "";
  }
  return headers;
}

function mcpResultToText(result: unknown): string {
  const r = result as { content?: Array<{ type?: string; text?: string }> };
  if (Array.isArray(r?.content)) {
    return r.content
      .map((c) => (c.type === "text" ? c.text ?? "" : JSON.stringify(c)))
      .join("\n")
      .trim();
  }
  return JSON.stringify(result);
}

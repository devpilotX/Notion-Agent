import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  real,
  vector,
  index,
} from "drizzle-orm/pg-core";

/**
 * Verdant engine data model.
 * pgvector columns use 768 dims (Google text-embedding-004);
 * change the dimension here if you switch embedding models.
 */

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  createdAt: createdAt(),
});

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    label: text("label").notNull(),
    // AES-256-GCM payload. Never the raw secret.
    secretEncrypted: text("secret_encrypted").notNull(),
    baseUrl: text("base_url"),
    // working | invalid | rate-limited | unknown
    status: text("status").notNull().default("unknown"),
    createdAt: createdAt(),
  },
  (t) => [index("api_keys_user_idx").on(t.userId)],
);

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    greeting: text("greeting"),
    instructions: text("instructions"),
    // auto | manual
    modelMode: text("model_mode").notNull().default("auto"),
    modelId: text("model_id"),
    maxSteps: integer("max_steps").notNull().default(12),
    settingsJson: jsonb("settings_json").notNull().default({}),
    favorite: boolean("favorite").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("agents_user_idx").on(t.userId)],
);

export const agentVersions = pgTable(
  "agent_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    configJson: jsonb("config_json").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("agent_versions_agent_idx").on(t.agentId)],
);

export const triggers = pgTable(
  "triggers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    // manual | mention | cron | webhook | email | file_watch
    type: text("type").notNull(),
    configJson: jsonb("config_json").notNull().default({}),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("triggers_agent_idx").on(t.agentId)],
);

export const connections = pgTable(
  "connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    // mcp | http | builtin
    kind: text("kind").notNull(),
    configJson: jsonb("config_json").notNull().default({}),
    // connected | error | disconnected
    status: text("status").notNull().default("disconnected"),
    createdAt: createdAt(),
  },
  (t) => [index("connections_agent_idx").on(t.agentId)],
);

export const tools = pgTable(
  "tools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    configJson: jsonb("config_json").notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("tools_agent_idx").on(t.agentId)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title"),
    createdAt: createdAt(),
  },
  (t) => [
    index("sessions_agent_idx").on(t.agentId),
    index("sessions_user_idx").on(t.userId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    // user | assistant | system | tool
    role: text("role").notNull(),
    content: text("content").notNull().default(""),
    stepsJson: jsonb("steps_json"),
    tokens: integer("tokens").notNull().default(0),
    cost: real("cost").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("messages_session_idx").on(t.sessionId)],
);

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    triggerId: uuid("trigger_id").references(() => triggers.id, {
      onDelete: "set null",
    }),
    // queued | running | ok | error | cancelled
    status: text("status").notNull().default("queued"),
    stepsJson: jsonb("steps_json"),
    tokens: integer("tokens").notNull().default(0),
    cost: real("cost").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("runs_agent_idx").on(t.agentId)],
);

export const memories = pgTable(
  "memories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 768 }),
    createdAt: createdAt(),
  },
  (t) => [
    index("memories_agent_idx").on(t.agentId),
    index("memories_embedding_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    chunk: text("chunk").notNull(),
    embedding: vector("embedding", { dimensions: 768 }),
  },
  (t) => [
    index("documents_agent_idx").on(t.agentId),
    index("documents_embedding_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export const sandboxes = pgTable(
  "sandboxes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    containerId: text("container_id"),
    // creating | running | stopped | error
    status: text("status").notNull().default("creating"),
    workspacePath: text("workspace_path"),
  },
  (t) => [index("sandboxes_session_idx").on(t.sessionId)],
);

// Convenience types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Run = typeof runs.$inferSelect;

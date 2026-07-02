import { pgFromEnv } from "./db-env.mjs";

/**
 * Idempotent schema sync for the Verdant engine.
 * Safe to run repeatedly: every statement uses IF NOT EXISTS guards.
 * Honors DATABASE_URL or the discrete PG* variables.
 * Run with:  node --env-file=.env server/scripts/migrate.mjs   (from repo root)
 */

const sql = pgFromEnv({ onnotice: () => {} }); // silence "already exists" notices

const log = (...a) => console.log("[migrate]", ...a);
const EMBED_DIM = 768; // Google gemini-embedding-001 at outputDimensionality 768

try {
  // --- 0. Core tables (users, keys, agents, sessions, messages, runs) so a
  //        completely fresh database bootstraps with this one script. ---
  await sql`CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    name text,
    password_hash text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS api_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider text NOT NULL,
    label text NOT NULL,
    secret_encrypted text NOT NULL,
    base_url text,
    status text NOT NULL DEFAULT 'unknown',
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys (user_id)`;

  await sql`CREATE TABLE IF NOT EXISTS agents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    icon text,
    greeting text,
    instructions text,
    model_mode text NOT NULL DEFAULT 'auto',
    model_id text,
    max_steps integer NOT NULL DEFAULT 12,
    settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    favorite boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS agents_user_idx ON agents (user_id)`;

  await sql`CREATE TABLE IF NOT EXISTS agent_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    config_json jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS agent_versions_agent_idx ON agent_versions (agent_id)`;

  await sql`CREATE TABLE IF NOT EXISTS sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS sessions_agent_idx ON sessions (agent_id)`;
  await sql`CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id)`;

  await sql`CREATE TABLE IF NOT EXISTS messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role text NOT NULL,
    content text NOT NULL DEFAULT '',
    steps_json jsonb,
    tokens integer NOT NULL DEFAULT 0,
    cost real NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS messages_session_idx ON messages (session_id)`;
  log("core tables ensured: users, api_keys, agents, agent_versions, sessions, messages");

  // --- 1. Columns the running code expects on existing tables ---
  await sql`ALTER TABLE agents ADD COLUMN IF NOT EXISTS instructions text`;
  await sql`ALTER TABLE agents ADD COLUMN IF NOT EXISTS settings_json jsonb NOT NULL DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE agents ADD COLUMN IF NOT EXISTS favorite boolean NOT NULL DEFAULT false`;
  log("agents columns ensured");

  // --- 2. pgvector extension (optional; RAG falls back to JS cosine if absent) ---
  let pgvector = false;
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    pgvector = true;
    log("pgvector extension: ENABLED");
  } catch (e) {
    log("pgvector extension: NOT available -", e.message);
  }

  // --- 3. Non-vector feature tables ---
  await sql`CREATE TABLE IF NOT EXISTS triggers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    type text NOT NULL,
    config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS triggers_agent_idx ON triggers (agent_id)`;

  // runs references triggers, so it is created after them.
  await sql`CREATE TABLE IF NOT EXISTS runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    trigger_id uuid REFERENCES triggers(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'queued',
    steps_json jsonb,
    tokens integer NOT NULL DEFAULT 0,
    cost real NOT NULL DEFAULT 0,
    duration_ms integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS runs_agent_idx ON runs (agent_id)`;

  await sql`CREATE TABLE IF NOT EXISTS connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    kind text NOT NULL,
    config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'disconnected',
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS connections_agent_idx ON connections (agent_id)`;

  await sql`CREATE TABLE IF NOT EXISTS tools (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name text NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS tools_agent_idx ON tools (agent_id)`;

  await sql`CREATE TABLE IF NOT EXISTS sandboxes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    container_id text,
    status text NOT NULL DEFAULT 'creating',
    workspace_path text
  )`;
  await sql`CREATE INDEX IF NOT EXISTS sandboxes_session_idx ON sandboxes (session_id)`;
  log("feature tables ensured: triggers, runs, connections, tools, sandboxes");

  // --- 4. Vector tables. Use vector type if available, else real[] for JS cosine. ---
  const embedType = pgvector ? `vector(${EMBED_DIM})` : `real[]`;
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS memories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    content text NOT NULL,
    embedding ${embedType},
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await sql`CREATE INDEX IF NOT EXISTS memories_agent_idx ON memories (agent_id)`;

  await sql.unsafe(`CREATE TABLE IF NOT EXISTS documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    source text NOT NULL,
    chunk text NOT NULL,
    embedding ${embedType},
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await sql`CREATE INDEX IF NOT EXISTS documents_agent_idx ON documents (agent_id)`;

  if (pgvector) {
    await sql`CREATE INDEX IF NOT EXISTS memories_embedding_idx ON memories USING hnsw (embedding vector_cosine_ops)`;
    await sql`CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents USING hnsw (embedding vector_cosine_ops)`;
    log(`vector tables ensured with vector(${EMBED_DIM}) + hnsw indexes`);
  } else {
    log("vector tables ensured with real[] embeddings (JS cosine fallback)");
  }

  log("done. pgvector =", pgvector);
} catch (e) {
  console.error("[migrate] ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}

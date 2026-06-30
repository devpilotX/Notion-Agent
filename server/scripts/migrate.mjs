import postgres from "postgres";

/**
 * Idempotent schema sync for the Verdant engine.
 * Safe to run repeatedly: every statement uses IF NOT EXISTS guards.
 * Run with:  node --env-file=.env server/scripts/migrate.mjs   (from repo root)
 */

const sql = postgres({
  host: process.env.PGHOST ?? "localhost",
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? "postgres",
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE ?? "verdant",
  onnotice: () => {}, // silence "already exists" notices
});

const log = (...a) => console.log("[migrate]", ...a);
const EMBED_DIM = 768; // Google text-embedding-004

try {
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
  log("feature tables ensured: triggers, connections, tools, sandboxes");

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

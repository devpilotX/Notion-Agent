import postgres from "postgres";

// Core chat tables for the runtime slice. No pgvector needed.
const sql = postgres({
  host: process.env.PGHOST ?? "localhost",
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? "postgres",
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE ?? "verdant",
});

try {
  await sql`CREATE TABLE IF NOT EXISTS agents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    icon text,
    greeting text,
    model_mode text NOT NULL DEFAULT 'auto',
    model_id text,
    max_steps integer NOT NULL DEFAULT 12,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS agents_user_idx ON agents (user_id)`;
  await sql`ALTER TABLE agents ADD COLUMN IF NOT EXISTS instructions text`;
  await sql`ALTER TABLE agents ADD COLUMN IF NOT EXISTS settings_json jsonb NOT NULL DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE agents ADD COLUMN IF NOT EXISTS favorite boolean NOT NULL DEFAULT false`;

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

  await sql`CREATE TABLE IF NOT EXISTS runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    trigger_id uuid,
    status text NOT NULL DEFAULT 'queued',
    steps_json jsonb,
    tokens integer NOT NULL DEFAULT 0,
    cost real NOT NULL DEFAULT 0,
    duration_ms integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS runs_agent_idx ON runs (agent_id)`;

  console.log("runtime tables ready: agents, sessions, messages, runs");
} finally {
  await sql.end({ timeout: 5 });
}

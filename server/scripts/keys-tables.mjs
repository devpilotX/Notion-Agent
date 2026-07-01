import { pgFromEnv } from "./db-env.mjs";

// Creates only the tables the keys slice needs, so we can run live without
// pgvector installed. Full `npm run db:push` covers the rest once pgvector exists.
const sql = pgFromEnv();

try {
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
  console.log("keys tables ready: users, api_keys");
} finally {
  await sql.end({ timeout: 5 });
}

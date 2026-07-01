import postgres from "postgres";

// First-time database setup: creates the database and enables pgvector when
// available. Reads DATABASE_URL or the discrete PG* variables
// (load with: node --env-file=.env server/scripts/setup-db.mjs).
const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const base = url
  ? {
      host: url.hostname || "localhost",
      port: Number(url.port || 5432),
      user: decodeURIComponent(url.username || "postgres"),
      password: decodeURIComponent(url.password ?? ""),
    }
  : {
      host: process.env.PGHOST ?? "localhost",
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.PGUSER ?? "postgres",
      password: process.env.PGPASSWORD,
    };
const dbName = url
  ? url.pathname.replace(/^\//, "") || "verdant"
  : process.env.PGDATABASE ?? "verdant";

const admin = postgres({ ...base, database: "postgres" });
try {
  const rows = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
  if (rows.length === 0) {
    await admin.unsafe(`CREATE DATABASE "${dbName}"`);
    console.log("created database:", dbName);
  } else {
    console.log("database exists:", dbName);
  }
} finally {
  await admin.end({ timeout: 5 });
}

const db = postgres({ ...base, database: dbName });
try {
  try {
    await db`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log("pgvector: ready");
  } catch (e) {
    console.log("pgvector: not available -", e.message, "(JS cosine fallback will be used)");
  }
  const v = await db`SELECT version() as version`;
  console.log("connected:", String(v[0].version).split(" on ")[0]);
} finally {
  await db.end({ timeout: 5 });
}

import postgres from "postgres";

// Reads PG* from the environment (load with: node --env-file=../.env scripts/setup-db.mjs)
const base = {
  host: process.env.PGHOST ?? "localhost",
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? "postgres",
  password: process.env.PGPASSWORD,
};
const dbName = process.env.PGDATABASE ?? "verdant";

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
  await db`CREATE EXTENSION IF NOT EXISTS vector`;
  const v = await db`SELECT version() as version`;
  console.log("connected:", String(v[0].version).split(" on ")[0]);
  console.log("pgvector: ready");
} finally {
  await db.end({ timeout: 5 });
}

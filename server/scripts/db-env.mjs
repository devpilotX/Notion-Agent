import postgres from "postgres";

/**
 * One shared way for scripts to open Postgres: DATABASE_URL when set,
 * otherwise the discrete PG* variables. Mirrors src/db/drizzle.ts.
 */
export function pgFromEnv(options = {}) {
  if (process.env.DATABASE_URL) {
    return postgres(process.env.DATABASE_URL, options);
  }
  return postgres({
    host: process.env.PGHOST ?? "localhost",
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? "postgres",
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE ?? "verdant",
    ...options,
  });
}

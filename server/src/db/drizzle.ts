import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;

export type DbConnection =
  | { url: string }
  | {
      host: string;
      port: number;
      user: string;
      password?: string;
      database: string;
    };

/** Build a Drizzle instance backed by a postgres.js pool. */
export function createDb(conn: DbConnection) {
  const client =
    "url" in conn
      ? postgres(conn.url, { max: 10 })
      : postgres({
          host: conn.host,
          port: conn.port,
          user: conn.user,
          password: conn.password,
          database: conn.database,
          max: 10,
        });
  return drizzle(client, { schema });
}

/**
 * Build a connection from the environment. Prefers DATABASE_URL; otherwise uses
 * discrete PG* vars, which avoid URL-encoding issues when a password contains
 * characters like "@".
 */
export function dbConnectionFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): DbConnection {
  if (env.DATABASE_URL) return { url: env.DATABASE_URL };
  return {
    host: env.PGHOST ?? "localhost",
    port: Number(env.PGPORT ?? 5432),
    user: env.PGUSER ?? "postgres",
    password: env.PGPASSWORD,
    database: env.PGDATABASE ?? "verdant",
  };
}

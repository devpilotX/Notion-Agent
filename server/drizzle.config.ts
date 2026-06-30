import { defineConfig } from "drizzle-kit";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// drizzle-kit runs standalone, so load the repo-root .env (then server/.env).
for (const p of ["../.env", ".env"]) {
  try {
    const text = readFileSync(resolve(process.cwd(), p), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch {
    /* file not present, ignore */
  }
}

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: url
    ? { url }
    : {
        host: process.env.PGHOST ?? "localhost",
        port: Number(process.env.PGPORT ?? 5432),
        user: process.env.PGUSER ?? "postgres",
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE ?? "verdant",
        ssl: false,
      },
  verbose: true,
  strict: true,
});

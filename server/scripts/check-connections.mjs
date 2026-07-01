import { pgFromEnv } from "./db-env.mjs";
const sql = pgFromEnv();
try {
  const rows = await sql`SELECT id, kind, status, config_json FROM connections`;
  console.log("connections:", rows.length);
  for (const r of rows) console.log(JSON.stringify(r));
} finally {
  await sql.end({ timeout: 5 });
}

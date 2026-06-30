import postgres from "postgres";

const sql = postgres({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

try {
  const col = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'agents' AND column_name = 'settings_json'`;
  console.log("agents.settings_json:", col.length ? "present" : "MISSING");
  const tbl = await sql`SELECT to_regclass('public.agent_versions') AS t`;
  console.log("agent_versions table:", tbl[0].t ? "present" : "MISSING");
} finally {
  await sql.end({ timeout: 5 });
}

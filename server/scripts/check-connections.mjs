import postgres from "postgres";
const sql = postgres({
  host: process.env.PGHOST, port: Number(process.env.PGPORT),
  user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE,
});
try {
  const rows = await sql`SELECT id, kind, status, config_json FROM connections`;
  console.log("connections:", rows.length);
  for (const r of rows) console.log(JSON.stringify(r));
} finally {
  await sql.end({ timeout: 5 });
}

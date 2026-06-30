import postgres from "postgres";

const sql = postgres({
  host: process.env.PGHOST ?? "localhost",
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? "postgres",
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE ?? "verdant",
});

try {
  const ext = await sql`SELECT extname FROM pg_extension WHERE extname = 'vector'`;
  console.log("pgvector installed:", ext.length > 0);

  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name`;
  console.log("TABLES:", tables.map((t) => t.table_name).join(", "));

  for (const t of tables) {
    const name = t.table_name;
    const c = await sql.unsafe(`SELECT count(*)::int AS n FROM "${name}"`);
    console.log(`  ${name}: ${c[0].n} rows`);
  }
} catch (e) {
  console.error("AUDIT ERROR:", e.message);
} finally {
  await sql.end({ timeout: 5 });
}

import postgres from "postgres";

const sql = postgres({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

try {
  const users = await sql`SELECT email FROM users ORDER BY created_at`;
  console.log("USERS:", users.map((u) => u.email).join(", ") || "(none)");
  const keys = await sql`SELECT provider, status, created_at FROM api_keys ORDER BY created_at DESC`;
  console.log("KEY_COUNT:", keys.length);
  for (const k of keys) console.log("KEY:", k.provider, k.status);
} finally {
  await sql.end({ timeout: 5 });
}

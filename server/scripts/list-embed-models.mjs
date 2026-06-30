import postgres from "postgres";
const { CryptoService } = await import("../dist/crypto/crypto.service.js");
const crypto = new CryptoService(process.env.MASTER_ENCRYPTION_KEY);
const sql = postgres({
  host: process.env.PGHOST, port: Number(process.env.PGPORT),
  user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE,
});
try {
  const rows = await sql`SELECT secret_encrypted FROM api_keys WHERE provider = 'google' LIMIT 1`;
  const key = crypto.decrypt(rows[0].secret_encrypted);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1000`);
  const data = await res.json();
  for (const m of data.models ?? []) {
    const methods = m.supportedGenerationMethods ?? [];
    if (methods.some((x) => /embed/i.test(x))) {
      console.log(m.name, "->", methods.join(","));
    }
  }
} finally {
  await sql.end({ timeout: 5 });
}

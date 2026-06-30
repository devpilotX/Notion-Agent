import postgres from "postgres";
const { CryptoService } = await import("../dist/crypto/crypto.service.js");

const BASE = process.env.BASE ?? "http://localhost:4000";
const crypto = new CryptoService(process.env.MASTER_ENCRYPTION_KEY);
const sql = postgres({
  host: process.env.PGHOST, port: Number(process.env.PGPORT),
  user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE,
});
const detect = (secret) =>
  fetch(`${BASE}/keys/detect`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret }),
  }).then((r) => r.json());

try {
  // Fix 5: cost-safe Auto resolution.
  const auto = await (await fetch(`${BASE}/models/auto`)).json();
  console.log("AUTO resolves to:", auto.label);

  // Fix 4: Kiro key is rejected with a clear message.
  const kiro = await detect("ksk_demo1234567890");
  console.log("ksk_ ->", kiro.usable === false ? "REJECTED" : "WRONG", "|", kiro.message?.slice(0, 60));

  // Fix 4: a real key auto-detects. Use the stored Google key (decrypted locally).
  const rows = await sql`SELECT secret_encrypted FROM api_keys WHERE provider = 'google' LIMIT 1`;
  if (rows.length) {
    const real = crypto.decrypt(rows[0].secret_encrypted);
    const det = await detect(real);
    console.log("real key ->", "provider:", det.provider, "usable:", det.usable, "models:", det.models?.length);
    console.log("DETECT RESULT:", det.provider === "google" && det.usable ? "PASS" : "CHECK");
  } else {
    console.log("no google key stored to test positive detect");
  }
} catch (e) {
  console.error("VERIFY ERROR:", e.message);
} finally {
  await sql.end({ timeout: 5 });
}

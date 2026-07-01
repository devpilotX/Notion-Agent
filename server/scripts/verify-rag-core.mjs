// Verifies the RAG retrieval core with REAL Google embeddings, no engine needed.
import { pgFromEnv } from "./db-env.mjs";
const { CryptoService } = await import("../dist/crypto/crypto.service.js");

const crypto = new CryptoService(process.env.MASTER_ENCRYPTION_KEY);
const sql = pgFromEnv();

function cosine(a, b) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na) * Math.sqrt(nb));
}

async function embed(key, texts) {
  const out = [];
  for (const text of texts) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/gemini-embedding-001",
          content: { parts: [{ text }] },
          outputDimensionality: 768,
        }),
      },
    );
    if (!res.ok) throw new Error(`embed failed ${res.status}: ${await res.text()}`);
    const data = await res.json();
    out.push(data.embedding.values);
  }
  return out;
}

try {
  const rows = await sql`SELECT secret_encrypted FROM api_keys WHERE provider = 'google' LIMIT 1`;
  if (!rows.length) { console.log("No Google key in DB"); process.exit(0); }
  const key = crypto.decrypt(rows[0].secret_encrypted);

  const doc = "The axolotl named Quill guards the canopy archive in the Verdant project.";
  const related = "Who guards the canopy archive?";
  const unrelated = "What is the best recipe for sourdough bread?";
  const [vDoc, vRel, vUn] = await embed(key, [doc, related, unrelated]);

  const simRelated = cosine(vRel, vDoc);
  const simUnrelated = cosine(vUn, vDoc);
  console.log("embedding dims:", vDoc.length);
  console.log("cosine(related, doc)  =", simRelated.toFixed(4));
  console.log("cosine(unrelated, doc)=", simUnrelated.toFixed(4));
  console.log("RESULT:", vDoc.length === 768 && simRelated > simUnrelated ? "PASS (relevant ranks higher)" : "CHECK");
} catch (e) {
  console.error("RAG CORE ERROR:", e.message);
} finally {
  await sql.end({ timeout: 5 });
}

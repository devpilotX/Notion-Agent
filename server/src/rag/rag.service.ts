import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import AdmZip from "adm-zip";
// pdf-parse ships a debug path on its index; import the lib entry directly.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { DRIZZLE } from "../db/db.module";
import type { Database } from "../db/drizzle";
import { agents, apiKeys } from "../db/schema";
import { CryptoService } from "../crypto/crypto.service";
import { UsersService } from "../users/users.service";

export type UploadFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

export type RetrievedChunk = { source: string; chunk: string; score: number };

const TEXT_EXT = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "log", "yaml", "yml",
  "ts", "tsx", "js", "jsx", "py", "java", "go", "rs", "rb", "c", "cpp", "h",
  "html", "htm", "xml", "css", "sql", "sh", "env", "ini", "toml",
]);
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico"]);

@Injectable()
export class RagService {
  private readonly log = new Logger("Rag");
  private readonly sql: ReturnType<typeof postgres>;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly crypto: CryptoService,
    private readonly users: UsersService,
  ) {
    this.sql = postgres({
      host: process.env.PGHOST ?? "localhost",
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.PGUSER ?? "postgres",
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE ?? "verdant",
      max: 4,
    });
  }

  private async agentId(userId: string): Promise<string> {
    const rows = await this.db
      .select({ id: agents.id })
      .from(agents)
      .where(eq(agents.userId, userId))
      .orderBy(agents.createdAt)
      .limit(1);
    return rows[0]?.id;
  }

  // ---------------------------------------------------------------- ingest

  async ingest(files: UploadFile[]): Promise<{ source: string; chunks: number; note?: string }[]> {
    const userId = await this.users.getCurrentUserId();
    const agentId = await this.agentId(userId);
    const out: { source: string; chunks: number; note?: string }[] = [];

    for (const file of files) {
      const extracted = await this.extract(file);
      for (const piece of extracted) {
        if (!piece.text.trim()) {
          out.push({ source: piece.source, chunks: 0, note: piece.note ?? "no text extracted" });
          continue;
        }
        const chunks = chunkText(piece.text);
        const embeddings = await this.embed(chunks);
        for (let i = 0; i < chunks.length; i++) {
          const lit = `{${embeddings[i].join(",")}}`; // postgres real[] literal
          await this.sql`
            INSERT INTO documents (agent_id, source, chunk, embedding)
            VALUES (${agentId}, ${piece.source}, ${chunks[i]}, ${lit}::real[])`;
        }
        out.push({ source: piece.source, chunks: chunks.length });
      }
    }
    return out;
  }

  async listSources(): Promise<{ source: string; chunks: number }[]> {
    const userId = await this.users.getCurrentUserId();
    const agentId = await this.agentId(userId);
    const rows = await this.sql<{ source: string; chunks: number }[]>`
      SELECT source, count(*)::int AS chunks FROM documents
      WHERE agent_id = ${agentId} GROUP BY source ORDER BY source`;
    return rows;
  }

  async removeSource(source: string): Promise<{ deleted: number }> {
    const userId = await this.users.getCurrentUserId();
    const agentId = await this.agentId(userId);
    const res = await this.sql`
      DELETE FROM documents WHERE agent_id = ${agentId} AND source = ${source}`;
    return { deleted: res.count };
  }

  // ---------------------------------------------------------------- retrieve

  async retrieve(agentId: string, query: string, k = 5): Promise<RetrievedChunk[]> {
    const rows = await this.sql<{ source: string; chunk: string; embedding: number[] }[]>`
      SELECT source, chunk, embedding FROM documents WHERE agent_id = ${agentId}`;
    if (rows.length === 0) return [];
    let q: number[];
    try {
      [q] = await this.embed([query]);
    } catch {
      return [];
    }
    return rows
      .map((r) => ({ source: r.source, chunk: r.chunk, score: cosine(q, r.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  // ---------------------------------------------------------------- helpers

  private async extract(
    file: UploadFile,
  ): Promise<{ source: string; text: string; note?: string }[]> {
    const ext = (file.originalname.split(".").pop() ?? "").toLowerCase();
    if (ext === "pdf") {
      try {
        const data = await pdfParse(file.buffer);
        return [{ source: file.originalname, text: data.text }];
      } catch (e) {
        return [{ source: file.originalname, text: "", note: `pdf parse failed: ${(e as Error).message}` }];
      }
    }
    if (ext === "zip") return this.extractZip(file);
    if (IMAGE_EXT.has(ext)) {
      return [{ source: file.originalname, text: "", note: "image stored, no OCR" }];
    }
    if (TEXT_EXT.has(ext) || file.mimetype.startsWith("text/")) {
      return [{ source: file.originalname, text: file.buffer.toString("utf8") }];
    }
    // Unknown type: best-effort utf8 (covers many plain formats).
    return [{ source: file.originalname, text: file.buffer.toString("utf8") }];
  }

  private extractZip(file: UploadFile): { source: string; text: string; note?: string }[] {
    const out: { source: string; text: string; note?: string }[] = [];
    try {
      const zip = new AdmZip(file.buffer);
      for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        const ext = (entry.entryName.split(".").pop() ?? "").toLowerCase();
        const source = `${file.originalname}/${entry.entryName}`;
        if (TEXT_EXT.has(ext)) {
          out.push({ source, text: entry.getData().toString("utf8") });
        } else {
          out.push({ source, text: "", note: "skipped (binary in zip)" });
        }
      }
    } catch (e) {
      out.push({ source: file.originalname, text: "", note: `zip read failed: ${(e as Error).message}` });
    }
    return out;
  }

  /** Embed texts with Google gemini-embedding-001 (768 dims). Needs a Google key. */
  private async embed(texts: string[]): Promise<number[][]> {
    const key = await this.googleKey();
    if (!key) throw new Error("No Google key for embeddings");
    const out: number[][] = [];
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
      if (!res.ok) throw new Error(`embed failed (${res.status})`);
      const data = (await res.json()) as { embedding?: { values: number[] } };
      if (data.embedding?.values) out.push(data.embedding.values);
    }
    return out;
  }

  private async googleKey(): Promise<string | null> {
    const userId = await this.users.getCurrentUserId();
    const rows = await this.db.select().from(apiKeys).where(eq(apiKeys.userId, userId));
    const g = rows.find((r) => r.provider === "google");
    if (!g) return null;
    try {
      return this.crypto.decrypt(g.secretEncrypted);
    } catch {
      return null;
    }
  }
}

function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= size) return clean ? [clean] : [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    chunks.push(clean.slice(start, start + size));
    start += size - overlap;
  }
  return chunks;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

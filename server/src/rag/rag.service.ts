import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import AdmZip from "adm-zip";
// pdf-parse ships a debug path on its index; import the lib entry directly.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { DRIZZLE } from "../db/db.module";
import type { Database } from "../db/drizzle";
import { dbConnectionFromEnv } from "../db/drizzle";
import { apiKeys } from "../db/schema";
import { getOrCreateDefaultAgent } from "../agents/agents.service";
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

const EMBED_BATCH = 100; // Google batchEmbedContents caps at 100 requests

@Injectable()
export class RagService implements OnModuleDestroy {
  private readonly log = new Logger("Rag");
  private readonly sql: ReturnType<typeof postgres>;
  // null = not probed yet; true = embedding column is pgvector, false = real[]
  private vectorColumn: boolean | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly crypto: CryptoService,
    private readonly users: UsersService,
  ) {
    // Honors DATABASE_URL and falls back to the discrete PG* vars, exactly
    // like the main Drizzle connection.
    const conn = dbConnectionFromEnv();
    this.sql =
      "url" in conn
        ? postgres(conn.url, { max: 4 })
        : postgres({
            host: conn.host,
            port: conn.port,
            user: conn.user,
            password: conn.password,
            database: conn.database,
            max: 4,
          });
  }

  async onModuleDestroy() {
    await this.sql.end({ timeout: 5 }).catch(() => {});
  }

  private async agentId(userId: string): Promise<string> {
    const agent = await getOrCreateDefaultAgent(this.db, userId);
    return agent.id;
  }

  /** Whether documents.embedding is a native pgvector column (cached). */
  private async usesVector(): Promise<boolean> {
    if (this.vectorColumn !== null) return this.vectorColumn;
    try {
      const rows = await this.sql<{ udt_name: string }[]>`
        SELECT udt_name FROM information_schema.columns
        WHERE table_name = 'documents' AND column_name = 'embedding'`;
      this.vectorColumn = rows[0]?.udt_name === "vector";
    } catch {
      this.vectorColumn = false;
    }
    return this.vectorColumn;
  }

  // ---------------------------------------------------------------- ingest

  async ingest(files: UploadFile[]): Promise<{ source: string; chunks: number; note?: string }[]> {
    if (files.length === 0) return [];
    const userId = await this.users.getCurrentUserId();
    const agentId = await this.agentId(userId);
    const key = await this.googleKey();
    if (!key) {
      throw new BadRequestException(
        "Documents need a Google key for embeddings (gemini-embedding-001). Add one in the Keys card, then upload again.",
      );
    }
    const vector = await this.usesVector();
    const out: { source: string; chunks: number; note?: string }[] = [];

    for (const file of files) {
      const extracted = await this.extract(file);
      for (const piece of extracted) {
        if (!piece.text.trim()) {
          out.push({ source: piece.source, chunks: 0, note: piece.note ?? "no text extracted" });
          continue;
        }
        const chunks = chunkText(piece.text);
        const embeddings = await this.embed(chunks, key);
        for (let i = 0; i < chunks.length; i++) {
          if (vector) {
            const lit = `[${embeddings[i].join(",")}]`; // pgvector literal
            await this.sql`
              INSERT INTO documents (agent_id, source, chunk, embedding)
              VALUES (${agentId}, ${piece.source}, ${chunks[i]}, ${lit}::vector)`;
          } else {
            const lit = `{${embeddings[i].join(",")}}`; // postgres real[] literal
            await this.sql`
              INSERT INTO documents (agent_id, source, chunk, embedding)
              VALUES (${agentId}, ${piece.source}, ${chunks[i]}, ${lit}::real[])`;
          }
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
    const key = await this.googleKey();
    if (!key) return [];
    let q: number[];
    try {
      [q] = await this.embed([query], key);
    } catch {
      return [];
    }

    // Native pgvector path: cosine distance in the database (uses the HNSW
    // index) instead of loading every chunk into Node.
    if (await this.usesVector()) {
      const lit = `[${q.join(",")}]`;
      const rows = await this.sql<{ source: string; chunk: string; score: number }[]>`
        SELECT source, chunk, 1 - (embedding <=> ${lit}::vector) AS score
        FROM documents
        WHERE agent_id = ${agentId} AND embedding IS NOT NULL
        ORDER BY embedding <=> ${lit}::vector
        LIMIT ${k}`;
      return rows.map((r) => ({ ...r, score: Number(r.score) }));
    }

    // real[] fallback: cosine similarity computed in Node.
    const rows = await this.sql<{ source: string; chunk: string; embedding: number[] }[]>`
      SELECT source, chunk, embedding FROM documents
      WHERE agent_id = ${agentId} AND embedding IS NOT NULL`;
    if (rows.length === 0) return [];
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

  /**
   * Embed texts with Google gemini-embedding-001 at 768 dims, batched up to
   * 100 texts per request so folder uploads stay fast.
   */
  private async embed(texts: string[], key: string): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += EMBED_BATCH) {
      const batch = texts.slice(i, i + EMBED_BATCH);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: batch.map((text) => ({
              model: "models/gemini-embedding-001",
              content: { parts: [{ text }] },
              outputDimensionality: 768,
            })),
          }),
        },
      );
      if (!res.ok) throw new Error(`embed failed (${res.status})`);
      const data = (await res.json()) as { embeddings?: Array<{ values: number[] }> };
      for (const e of data.embeddings ?? []) out.push(e.values);
    }
    if (out.length !== texts.length) {
      throw new Error(`embed returned ${out.length} vectors for ${texts.length} texts`);
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

export function chunkText(text: string, size = 1200, overlap = 150): string[] {
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

export function cosine(a: number[], b: number[]): number {
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

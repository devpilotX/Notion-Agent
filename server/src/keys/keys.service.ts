import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { DRIZZLE } from "../db/db.module";
import type { Database } from "../db/drizzle";
import { apiKeys } from "../db/schema";
import { CryptoService } from "../crypto/crypto.service";
import { UsersService } from "../users/users.service";
import { validateKey, type KeyStatus } from "./provider-validate";

export type KeyView = {
  id: string;
  provider: string;
  label: string;
  masked: string;
  status: KeyStatus;
  baseUrl: string | null;
  createdAt: Date;
};

export type CreateKeyInput = {
  provider: string;
  label: string;
  secret: string;
  baseUrl?: string;
};

@Injectable()
export class KeysService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly crypto: CryptoService,
    private readonly users: UsersService,
  ) {}

  private toView = (k: typeof apiKeys.$inferSelect): KeyView => {
    let masked = "•••• ••••";
    try {
      masked = CryptoService.mask(this.crypto.decrypt(k.secretEncrypted));
    } catch {
      /* leave default mask if decryption fails */
    }
    return {
      id: k.id,
      provider: k.provider,
      label: k.label,
      masked,
      status: k.status as KeyStatus,
      baseUrl: k.baseUrl,
      createdAt: k.createdAt,
    };
  };

  async list(): Promise<KeyView[]> {
    const userId = await this.users.getCurrentUserId();
    const rows = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));
    return rows.map(this.toView);
  }

  /**
   * Detect a key's provider from its shape, then confirm by listing models.
   * Rejects Kiro keys (ksk_) which cannot power models here.
   */
  async detect(secret: string): Promise<{
    provider: string | null;
    status: KeyStatus;
    models: string[];
    usable: boolean;
    message?: string;
  }> {
    const s = secret.trim();
    if (s.startsWith("ksk_")) {
      return {
        provider: null,
        status: "invalid",
        models: [],
        usable: false,
        message:
          "This is a Kiro key. It signs in to Kiro and cannot power models here. Paste a provider key, for example OpenAI, Anthropic, Google, Groq, or OpenRouter.",
      };
    }
    for (const provider of candidatesFor(s)) {
      const { status, models } = await validateKey(provider, s);
      if (status === "working") {
        return { provider, status, models, usable: true };
      }
    }
    return {
      provider: null,
      status: "invalid",
      models: [],
      usable: false,
      message:
        "This key did not match or validate any supported provider. Check the key and try again.",
    };
  }

  async create(input: CreateKeyInput): Promise<KeyView> {
    const userId = await this.users.getCurrentUserId();
    const { status } = await validateKey(input.provider, input.secret, input.baseUrl);
    const secretEncrypted = this.crypto.encrypt(input.secret);
    const [row] = await this.db
      .insert(apiKeys)
      .values({
        userId,
        provider: input.provider,
        label: input.label,
        secretEncrypted,
        baseUrl: input.baseUrl ?? null,
        status,
      })
      .returning();
    return this.toView(row);
  }

  private async ownedKey(id: string) {
    const userId = await this.users.getCurrentUserId();
    const [row] = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
      .limit(1);
    if (!row) throw new NotFoundException("Key not found");
    return row;
  }

  async validate(id: string): Promise<{ id: string; status: KeyStatus; models: string[] }> {
    const row = await this.ownedKey(id);
    const secret = this.crypto.decrypt(row.secretEncrypted);
    const { status, models } = await validateKey(row.provider, secret, row.baseUrl);
    await this.db.update(apiKeys).set({ status }).where(eq(apiKeys.id, id));
    return { id, status, models };
  }

  async rotate(id: string, secret: string): Promise<KeyView> {
    const row = await this.ownedKey(id);
    const { status } = await validateKey(row.provider, secret, row.baseUrl);
    const secretEncrypted = this.crypto.encrypt(secret);
    const [updated] = await this.db
      .update(apiKeys)
      .set({ secretEncrypted, status })
      .where(eq(apiKeys.id, id))
      .returning();
    return this.toView(updated);
  }

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    await this.ownedKey(id);
    await this.db.delete(apiKeys).where(eq(apiKeys.id, id));
    return { id, deleted: true };
  }
}



/** Ordered provider candidates to try for a pasted key, based on its prefix. */
function candidatesFor(secret: string): string[] {
  const s = secret.trim();
  if (s.startsWith("sk-ant")) return ["anthropic"];
  if (s.startsWith("AIza")) return ["google"];
  if (s.startsWith("gsk_")) return ["groq"];
  if (s.startsWith("sk-or")) return ["openrouter"];
  if (s.startsWith("xai-")) return ["xai"];
  if (s.startsWith("sk-")) return ["openai", "deepseek"];
  // No distinctive prefix: try the providers that use plain keys.
  return ["mistral", "cohere", "together", "deepseek", "openrouter", "openai"];
}

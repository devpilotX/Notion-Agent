import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq, isNotNull } from "drizzle-orm";
import { DRIZZLE } from "../db/db.module";
import type { Database } from "../db/drizzle";
import { users } from "../db/schema";
import { hashPassword, signSession, verifyPassword, verifySession } from "./auth.util";

export type AuthUser = { id: string; email: string; name: string | null };

const DEMO_EMAIL = "demo@verdant.local";
const LOCK_AFTER = 5; // failed attempts
const LOCK_MS = 60_000;

@Injectable()
export class AuthService {
  private failures = new Map<string, { count: number; until: number }>();

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: ConfigService,
  ) {}

  get enabled(): boolean {
    return (this.config.get<string>("AUTH_ENABLED") ?? "").toLowerCase() === "true";
  }

  private get secret(): string {
    const s = this.config.get<string>("AUTH_SECRET");
    if (!s || s.length < 16 || /replace_with/.test(s)) {
      throw new Error(
        "AUTH_ENABLED needs a strong AUTH_SECRET in .env. Generate one with: openssl rand -hex 32",
      );
    }
    return s;
  }

  issueToken(userId: string): string {
    return signSession(userId, this.secret);
  }

  userIdFromToken(token: string): string | null {
    try {
      return verifySession(token, this.secret);
    } catch {
      return null;
    }
  }

  /**
   * Create an account. The very first signup claims the local demo user (and
   * with it every agent, key, and session made in single-user mode), so
   * enabling auth never orphans existing data.
   */
  async signup(email: string, password: string, name?: string): Promise<AuthUser> {
    const normalized = email.trim().toLowerCase();
    const [existing] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, normalized))
      .limit(1);
    if (existing) throw new BadRequestException("An account with this email already exists.");

    const passwordHash = hashPassword(password);

    const [registered] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(isNotNull(users.passwordHash))
      .limit(1);
    if (!registered) {
      const [demo] = await this.db
        .select()
        .from(users)
        .where(eq(users.email, DEMO_EMAIL))
        .limit(1);
      if (demo) {
        const [claimed] = await this.db
          .update(users)
          .set({ email: normalized, name: name ?? demo.name, passwordHash })
          .where(eq(users.id, demo.id))
          .returning();
        return { id: claimed.id, email: claimed.email, name: claimed.name };
      }
    }

    const [created] = await this.db
      .insert(users)
      .values({ email: normalized, name: name ?? null, passwordHash })
      .returning();
    return { id: created.id, email: created.email, name: created.name };
  }

  async signin(email: string, password: string): Promise<AuthUser> {
    const normalized = email.trim().toLowerCase();
    const lock = this.failures.get(normalized);
    if (lock && lock.count >= LOCK_AFTER && Date.now() < lock.until) {
      throw new UnauthorizedException("Too many attempts. Try again in a minute.");
    }

    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, normalized))
      .limit(1);
    if (!row?.passwordHash || !verifyPassword(password, row.passwordHash)) {
      const next = {
        count: (lock?.count ?? 0) + 1,
        until: Date.now() + LOCK_MS,
      };
      this.failures.set(normalized, next);
      throw new UnauthorizedException("Wrong email or password.");
    }
    this.failures.delete(normalized);
    return { id: row.id, email: row.email, name: row.name };
  }

  async me(userId: string): Promise<AuthUser | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row ? { id: row.id, email: row.email, name: row.name } : null;
  }

  async updateName(userId: string, name: string): Promise<AuthUser> {
    const [row] = await this.db
      .update(users)
      .set({ name })
      .where(eq(users.id, userId))
      .returning();
    if (!row) throw new UnauthorizedException("Account not found.");
    return { id: row.id, email: row.email, name: row.name };
  }

  async changePassword(userId: string, current: string, next: string): Promise<void> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!row?.passwordHash || !verifyPassword(current, row.passwordHash)) {
      throw new UnauthorizedException("The current password is wrong.");
    }
    await this.db
      .update(users)
      .set({ passwordHash: hashPassword(next) })
      .where(eq(users.id, userId));
  }
}

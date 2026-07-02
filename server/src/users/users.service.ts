import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AsyncLocalStorage } from "node:async_hooks";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "../db/db.module";
import type { Database } from "../db/drizzle";
import { users } from "../db/schema";

type UserContext = { userId: string };

@Injectable()
export class UsersService {
  /** Per-request (or per-headless-run) user context. */
  private static readonly als = new AsyncLocalStorage<UserContext>();

  private demoIdCache: string | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly config: ConfigService,
  ) {}

  /**
   * The acting user. With auth enabled, the guard binds the signed-in user to
   * the async context and headless work (trigger fires) binds the resource
   * owner via runAs — the demo fallback must then never be reached, so it
   * fails loudly instead of silently touching a ghost account. Without auth,
   * local single-user mode falls back to the demo user as before.
   */
  async getCurrentUserId(): Promise<string> {
    const ctx = UsersService.als.getStore();
    if (ctx?.userId) return ctx.userId;
    const authEnabled =
      (this.config.get<string>("AUTH_ENABLED") ?? "").toLowerCase() === "true";
    if (authEnabled) throw new UnauthorizedException("Sign in required.");
    return this.demoUserId();
  }

  /** Run a function with the user context bound (headless trigger runs). */
  runAs<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    return UsersService.als.run({ userId }, fn);
  }

  /** Bind the user for the remainder of the current request (middleware). */
  bindUser(userId: string): void {
    UsersService.als.enterWith({ userId });
  }

  private async demoUserId(): Promise<string> {
    if (this.demoIdCache) return this.demoIdCache;
    const email = "demo@verdant.local";

    const existing = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing.length) {
      this.demoIdCache = existing[0].id;
      return this.demoIdCache;
    }

    const [created] = await this.db
      .insert(users)
      .values({ email, name: "You" })
      .returning();
    this.demoIdCache = created.id;
    return this.demoIdCache;
  }
}

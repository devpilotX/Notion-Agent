import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "../db/db.module";
import type { Database } from "../db/drizzle";
import { users } from "../db/schema";

@Injectable()
export class UsersService {
  private cachedId: string | null = null;

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Local single-user mode until Better-Auth lands: resolve or create a demo
   * user and reuse its id for ownership checks.
   */
  async getCurrentUserId(): Promise<string> {
    if (this.cachedId) return this.cachedId;
    const email = "demo@verdant.local";

    const existing = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing.length) {
      this.cachedId = existing[0].id;
      return this.cachedId;
    }

    const [created] = await this.db
      .insert(users)
      .values({ email, name: "You" })
      .returning();
    this.cachedId = created.id;
    return this.cachedId;
  }
}

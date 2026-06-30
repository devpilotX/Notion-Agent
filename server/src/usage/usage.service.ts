import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { DRIZZLE } from "../db/db.module";
import type { Database } from "../db/drizzle";
import { runs } from "../db/schema";
import { UsersService } from "../users/users.service";
import { AgentsService } from "../agents/agents.service";

@Injectable()
export class UsageService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly users: UsersService,
    private readonly agents: AgentsService,
  ) {}

  async get() {
    const userId = await this.users.getCurrentUserId();
    const agent = await this.agents.getOrCreateDefault(userId);
    const [row] = await this.db
      .select({
        tokens: sql<number>`coalesce(sum(${runs.tokens}), 0)`.mapWith(Number),
        cost: sql<number>`coalesce(sum(${runs.cost}), 0)`.mapWith(Number),
        runs: sql<number>`count(*)`.mapWith(Number),
      })
      .from(runs)
      .where(eq(runs.agentId, agent.id));
    return {
      tokens: row?.tokens ?? 0,
      cost: row?.cost ?? 0,
      runs: row?.runs ?? 0,
    };
  }
}

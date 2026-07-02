import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { DRIZZLE } from "../db/db.module";
import type { Database } from "../db/drizzle";
import { runs } from "../db/schema";
import { UsersService } from "../users/users.service";
import { AgentsService } from "../agents/agents.service";

export type UsageSummary = {
  tokens: number;
  cost: number;
  runs: number;
  last24h: { tokens: number; cost: number; runs: number };
  triggered: { tokens: number; cost: number; runs: number };
  days: Array<{ day: string; tokens: number; cost: number; runs: number }>;
};

@Injectable()
export class UsageService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly users: UsersService,
    private readonly agents: AgentsService,
  ) {}

  async get(): Promise<UsageSummary> {
    const userId = await this.users.getCurrentUserId();
    const agent = await this.agents.getOrCreateDefault(userId);

    const rollup = {
      tokens: sql<number>`coalesce(sum(${runs.tokens}), 0)`.mapWith(Number),
      cost: sql<number>`coalesce(sum(${runs.cost}), 0)`.mapWith(Number),
      runs: sql<number>`count(*)`.mapWith(Number),
    };

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [total] = await this.db
      .select(rollup)
      .from(runs)
      .where(eq(runs.agentId, agent.id));
    const [last24h] = await this.db
      .select(rollup)
      .from(runs)
      .where(and(eq(runs.agentId, agent.id), gte(runs.createdAt, dayAgo)));
    const [triggered] = await this.db
      .select(rollup)
      .from(runs)
      .where(and(eq(runs.agentId, agent.id), isNotNull(runs.triggerId)));
    const days = await this.db
      .select({
        day: sql<string>`to_char(${runs.createdAt}, 'YYYY-MM-DD')`,
        ...rollup,
      })
      .from(runs)
      .where(and(eq(runs.agentId, agent.id), gte(runs.createdAt, weekAgo)))
      .groupBy(sql`to_char(${runs.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${runs.createdAt}, 'YYYY-MM-DD') DESC`);

    const zero = { tokens: 0, cost: 0, runs: 0 };
    return {
      ...(total ?? zero),
      last24h: last24h ?? zero,
      triggered: triggered ?? zero,
      days,
    };
  }
}

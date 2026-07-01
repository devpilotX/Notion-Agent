import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { DRIZZLE } from "../db/db.module";
import type { Database } from "../db/drizzle";
import { messages, sessions } from "../db/schema";
import { UsersService } from "../users/users.service";
import { AgentsService } from "../agents/agents.service";

export type SessionView = {
  id: string;
  title: string;
  createdAt: Date;
  messageCount: number;
};

@Injectable()
export class SessionsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly users: UsersService,
    private readonly agents: AgentsService,
  ) {}

  async list(): Promise<SessionView[]> {
    const userId = await this.users.getCurrentUserId();
    const agent = await this.agents.getOrCreateDefault(userId);
    const rows = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.agentId, agent.id))
      .orderBy(desc(sessions.createdAt));
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const msgs = await this.db
      .select({
        sessionId: messages.sessionId,
        role: messages.role,
        content: messages.content,
      })
      .from(messages)
      .where(inArray(messages.sessionId, ids))
      .orderBy(asc(messages.createdAt));

    const firstUser = new Map<string, string>();
    const count = new Map<string, number>();
    for (const m of msgs) {
      count.set(m.sessionId, (count.get(m.sessionId) ?? 0) + 1);
      if (m.role === "user" && !firstUser.has(m.sessionId)) {
        firstUser.set(m.sessionId, m.content);
      }
    }

    return rows.map((r) => ({
      id: r.id,
      title: r.title ?? firstUser.get(r.id) ?? "New session",
      createdAt: r.createdAt,
      messageCount: count.get(r.id) ?? 0,
    }));
  }

  async messages(sessionId: string) {
    const userId = await this.users.getCurrentUserId();
    const [s] = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .limit(1);
    if (!s) throw new NotFoundException("Session not found");

    const rows = await this.db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt));
    return rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    }));
  }

  async create(): Promise<SessionView> {
    const userId = await this.users.getCurrentUserId();
    const agent = await this.agents.getOrCreateDefault(userId);
    const [s] = await this.db
      .insert(sessions)
      .values({ agentId: agent.id, userId, title: null })
      .returning();
    return { id: s.id, title: "New session", createdAt: s.createdAt, messageCount: 0 };
  }

  async rename(sessionId: string, title: string): Promise<SessionView> {
    const userId = await this.users.getCurrentUserId();
    const [s] = await this.db
      .update(sessions)
      .set({ title })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .returning();
    if (!s) throw new NotFoundException("Session not found");
    const [{ count }] = await this.db
      .select({ count: sqlCount() })
      .from(messages)
      .where(eq(messages.sessionId, sessionId));
    return {
      id: s.id,
      title: s.title ?? "New session",
      createdAt: s.createdAt,
      messageCount: Number(count),
    };
  }

  async remove(sessionId: string): Promise<{ id: string; deleted: true }> {
    const userId = await this.users.getCurrentUserId();
    const res = await this.db
      .delete(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .returning({ id: sessions.id });
    if (!res.length) throw new NotFoundException("Session not found");
    return { id: sessionId, deleted: true };
  }
}

function sqlCount() {
  return sql<number>`count(*)`.mapWith(Number);
}

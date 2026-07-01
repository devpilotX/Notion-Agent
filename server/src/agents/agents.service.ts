import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DRIZZLE } from "../db/db.module";
import type { Database } from "../db/drizzle";
import { agents, agentVersions } from "../db/schema";

export const DEFAULT_INSTRUCTIONS =
  "You are Fern, a calm and helpful agent. Answer clearly and concisely, and work in small, verifiable steps.";

export type AgentSettings = {
  triggers: { run: boolean; newChat: boolean; mention: boolean };
  webAccess: boolean;
  trustedUrls: string[];
  allowAllUrls: boolean;
};

export const DEFAULT_SETTINGS: AgentSettings = {
  triggers: { run: true, newChat: true, mention: false },
  webAccess: true,
  trustedUrls: ["docs.agentforge.dev", "api.weather.gov"],
  allowAllUrls: false,
};

export type AgentPatch = {
  name?: string;
  instructions?: string;
  modelMode?: "auto" | "manual";
  modelId?: string | null;
  favorite?: boolean;
};

export type AgentConfigInput = {
  name: string;
  description?: string | null;
  instructions?: string | null;
  modelMode: "auto" | "manual";
  modelId?: string | null;
  settings: AgentSettings;
};

/**
 * Resolve the user's first agent, creating the default one when none exists.
 * Shared with services (rag, connections) that cannot inject AgentsService
 * without creating a module cycle.
 */
export async function getOrCreateDefaultAgent(db: Database, userId: string) {
  const existing = await db
    .select()
    .from(agents)
    .where(eq(agents.userId, userId))
    .orderBy(agents.createdAt)
    .limit(1);
  if (existing.length) return existing[0];

  const [created] = await db
    .insert(agents)
    .values({
      userId,
      name: "Fern",
      greeting: "Good morning. It's quiet here. What do you want to work on?",
      instructions: DEFAULT_INSTRUCTIONS,
      modelMode: "auto",
      maxSteps: 12,
      settingsJson: DEFAULT_SETTINGS,
    })
    .returning();
  return created;
}

@Injectable()
export class AgentsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async getOrCreateDefault(userId: string) {
    return getOrCreateDefaultAgent(this.db, userId);
  }

  async get(userId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(agents)
      .where(and(eq(agents.id, id), eq(agents.userId, userId)))
      .limit(1);
    return row ?? null;
  }

  async update(userId: string, id: string, patch: AgentPatch) {
    if (Object.keys(patch).length === 0) {
      const current = await this.get(userId, id);
      if (!current) throw new NotFoundException("Agent not found");
      return current;
    }
    const [row] = await this.db
      .update(agents)
      .set(patch)
      .where(and(eq(agents.id, id), eq(agents.userId, userId)))
      .returning();
    if (!row) throw new NotFoundException("Agent not found");
    return row;
  }

  async saveConfig(userId: string, id: string, cfg: AgentConfigInput) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(agents)
        .set({
          name: cfg.name,
          description: cfg.description ?? null,
          instructions: cfg.instructions ?? null,
          modelMode: cfg.modelMode,
          modelId: cfg.modelId ?? null,
          settingsJson: cfg.settings,
        })
        .where(and(eq(agents.id, id), eq(agents.userId, userId)))
        .returning();
      if (!row) throw new NotFoundException("Agent not found");
      await tx.insert(agentVersions).values({ agentId: id, configJson: cfg });
      return row;
    });
  }

  /** Clone an agent's full config into a new agent. */
  async duplicate(userId: string, id: string) {
    const src = await this.get(userId, id);
    if (!src) throw new NotFoundException("Agent not found");
    const [created] = await this.db
      .insert(agents)
      .values({
        userId,
        name: `${src.name} copy`,
        description: src.description,
        icon: src.icon,
        greeting: src.greeting,
        instructions: src.instructions,
        modelMode: src.modelMode,
        modelId: src.modelId,
        maxSteps: src.maxSteps,
        settingsJson: src.settingsJson,
        favorite: false,
      })
      .returning();
    await this.db
      .insert(agentVersions)
      .values({ agentId: created.id, configJson: { clonedFrom: id, name: created.name } });
    return created;
  }

  /** Restore the default config and record a version row. */
  async reset(userId: string, id: string) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(agents)
        .set({
          name: "Fern",
          description: null,
          instructions: DEFAULT_INSTRUCTIONS,
          modelMode: "auto",
          modelId: null,
          settingsJson: DEFAULT_SETTINGS,
          favorite: false,
        })
        .where(and(eq(agents.id, id), eq(agents.userId, userId)))
        .returning();
      if (!row) throw new NotFoundException("Agent not found");
      await tx
        .insert(agentVersions)
        .values({ agentId: id, configJson: { reset: true, name: "Fern" } });
      return row;
    });
  }

  async remove(userId: string, id: string) {
    const res = await this.db
      .delete(agents)
      .where(and(eq(agents.id, id), eq(agents.userId, userId)))
      .returning({ id: agents.id });
    if (!res.length) throw new NotFoundException("Agent not found");
    return { id, deleted: true as const };
  }
}

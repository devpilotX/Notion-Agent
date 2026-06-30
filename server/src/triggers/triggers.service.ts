import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import * as fs from "node:fs";
import * as net from "node:net";
import { and, desc, eq } from "drizzle-orm";
import { DRIZZLE } from "../db/db.module";
import type { Database } from "../db/drizzle";
import { triggers } from "../db/schema";
import { UsersService } from "../users/users.service";
import { AgentsService } from "../agents/agents.service";
import { RuntimeService } from "../runtime/runtime.service";
import { cronMatches } from "./cron";

export type TriggerType = "scheduled" | "webhook" | "email" | "file" | "manual" | "mention";

export type TriggerConfig = {
  cron?: string;
  intervalSec?: number;
  path?: string;
  token?: string;
  address?: string;
  message?: string;
};

export type TriggerView = {
  id: string;
  type: TriggerType;
  enabled: boolean;
  config: TriggerConfig;
  createdAt: Date;
};

const DEFAULT_MESSAGE = "Scheduled run: do your job and report briefly.";

@Injectable()
export class TriggersService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("Triggers");
  private intervalTimers = new Map<string, NodeJS.Timeout>();
  private fileWatchers = new Map<string, fs.FSWatcher>();
  private cronTick: NodeJS.Timeout | null = null;
  private lastCronMinute = "";

  // BullMQ handles (only created when Redis is reachable).
  private queue: import("bullmq").Queue | null = null;
  private worker: import("bullmq").Worker | null = null;
  private redisAvailable = false;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly users: UsersService,
    private readonly agents: AgentsService,
    private readonly runtime: RuntimeService,
  ) {}

  async onModuleInit() {
    this.redisAvailable = await this.probeRedis();
    if (!this.redisAvailable) {
      // Triggers still persist to Postgres and can be fired manually; the
      // background queue simply stays off. No connection, no retry loop.
      this.log.log("trigger queue disabled, Redis not running.");
      return;
    }
    await this.startBullMq();
    const rows = await this.db.select().from(triggers).where(eq(triggers.enabled, true));
    for (const r of rows) await this.schedule(this.toView(r));
    this.cronTick = setInterval(() => void this.evaluateCron(), 15_000);
    this.log.log("trigger queue active (BullMQ).");
  }

  onModuleDestroy() {
    for (const t of this.intervalTimers.values()) clearInterval(t);
    for (const w of this.fileWatchers.values()) w.close();
    if (this.cronTick) clearInterval(this.cronTick);
    void this.queue?.close();
    void this.worker?.close();
  }

  // ---------------------------------------------------------------- CRUD

  private toView(r: typeof triggers.$inferSelect): TriggerView {
    return {
      id: r.id,
      type: r.type as TriggerType,
      enabled: r.enabled,
      config: (r.configJson as TriggerConfig) ?? {},
      createdAt: r.createdAt,
    };
  }

  async list(): Promise<TriggerView[]> {
    const userId = await this.users.getCurrentUserId();
    const agent = await this.agents.getOrCreateDefault(userId);
    const rows = await this.db
      .select()
      .from(triggers)
      .where(eq(triggers.agentId, agent.id))
      .orderBy(desc(triggers.createdAt));
    return rows.map((r) => this.toView(r));
  }

  async create(type: TriggerType, config: TriggerConfig): Promise<TriggerView> {
    const userId = await this.users.getCurrentUserId();
    const agent = await this.agents.getOrCreateDefault(userId);
    if (type === "webhook" && !config.token) {
      config = { ...config, token: cryptoToken() };
    }
    const [row] = await this.db
      .insert(triggers)
      .values({ agentId: agent.id, type, configJson: config, enabled: true })
      .returning();
    const view = this.toView(row);
    await this.schedule(view);
    return view;
  }

  async update(
    id: string,
    patch: { enabled?: boolean; config?: TriggerConfig },
  ): Promise<TriggerView> {
    const set: Record<string, unknown> = {};
    if (patch.enabled !== undefined) set.enabled = patch.enabled;
    if (patch.config !== undefined) set.configJson = patch.config;
    const [row] = await this.db
      .update(triggers)
      .set(set)
      .where(eq(triggers.id, id))
      .returning();
    if (!row) throw new NotFoundException("Trigger not found");
    const view = this.toView(row);
    this.unschedule(id);
    if (view.enabled) await this.schedule(view);
    return view;
  }

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    this.unschedule(id);
    const res = await this.db
      .delete(triggers)
      .where(eq(triggers.id, id))
      .returning({ id: triggers.id });
    if (!res.length) throw new NotFoundException("Trigger not found");
    return { id, deleted: true };
  }

  // ---------------------------------------------------------------- firing

  /** Fire a trigger by id: starts a real headless run linked to the trigger. */
  async fire(id: string, overrideMessage?: string): Promise<{ runId: string; reply: string }> {
    const [row] = await this.db.select().from(triggers).where(eq(triggers.id, id)).limit(1);
    if (!row) throw new NotFoundException("Trigger not found");
    return this.fireView(this.toView(row), overrideMessage);
  }

  /** Fire a webhook trigger found by its secret token. */
  async fireWebhook(token: string, payloadText?: string) {
    const rows = await this.db.select().from(triggers).where(eq(triggers.type, "webhook"));
    const match = rows.find((r) => (r.configJson as TriggerConfig)?.token === token);
    if (!match) throw new NotFoundException("Webhook not found");
    return this.fireView(this.toView(match), payloadText);
  }

  private async fireView(view: TriggerView, overrideMessage?: string) {
    const message = overrideMessage || view.config.message || DEFAULT_MESSAGE;
    const userId = await this.users.getCurrentUserId();
    const agent = await this.agents.getOrCreateDefault(userId);
    let reply = "";
    let runId = "";
    await this.runtime.run(
      { agentId: agent.id, message, triggerId: view.id },
      (e) => {
        if (e.type === "run.start") runId = e.runId;
        if (e.type === "message.delta") reply += e.text;
      },
    );
    this.log.log(`fired trigger ${view.id} (${view.type}) -> run ${runId}`);
    return { runId, reply };
  }

  // ---------------------------------------------------------------- scheduling

  private async schedule(view: TriggerView) {
    if (!view.enabled) return;
    if (!this.redisAvailable) return; // queue off: triggers persist but stay inactive
    if (view.type === "file" && view.config.path) {
      this.watchFile(view);
      return;
    }
    if (view.type !== "scheduled") return; // webhook/email/manual/mention fire on demand
    const { intervalSec, cron } = view.config;

    if (this.redisAvailable && this.queue) {
      const repeat = cron ? { pattern: cron } : { every: (intervalSec ?? 60) * 1000 };
      await this.queue.add(view.id, { id: view.id }, { repeat, jobId: view.id });
      return;
    }
    // In-process: interval timers fire directly; cron is handled by the shared tick.
    if (intervalSec && intervalSec > 0) {
      const t = setInterval(() => void this.fire(view.id).catch(() => {}), intervalSec * 1000);
      this.intervalTimers.set(view.id, t);
    }
  }

  private unschedule(id: string) {
    const t = this.intervalTimers.get(id);
    if (t) {
      clearInterval(t);
      this.intervalTimers.delete(id);
    }
    const w = this.fileWatchers.get(id);
    if (w) {
      w.close();
      this.fileWatchers.delete(id);
    }
    if (this.queue) void this.queue.removeRepeatable(id, {}).catch(() => {});
  }

  private watchFile(view: TriggerView) {
    const path = view.config.path;
    if (!path || !fs.existsSync(path)) {
      this.log.warn(`file trigger ${view.id}: path missing (${path})`);
      return;
    }
    let debounce: NodeJS.Timeout | null = null;
    const watcher = fs.watch(path, () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void this.fire(view.id).catch(() => {}), 400);
    });
    this.fileWatchers.set(view.id, watcher);
  }

  /** In-process cron: once per wall-clock minute, fire any matching cron triggers. */
  private async evaluateCron() {
    const now = new Date();
    const minute = `${now.getHours()}:${now.getMinutes()}`;
    if (minute === this.lastCronMinute) return;
    this.lastCronMinute = minute;
    const rows = await this.db
      .select()
      .from(triggers)
      .where(and(eq(triggers.enabled, true), eq(triggers.type, "scheduled")));
    for (const r of rows) {
      const cfg = (r.configJson as TriggerConfig) ?? {};
      if (cfg.cron && cronMatches(cfg.cron, now)) {
        void this.fire(r.id).catch(() => {});
      }
    }
  }

  /** Fast, one-shot TCP probe. No ioredis, no retry loop, no error spam. */
  private probeRedis(): Promise<boolean> {
    const url = process.env.REDIS_URL;
    if (!url) return Promise.resolve(false);
    let host = "127.0.0.1";
    let port = 6379;
    try {
      const u = new URL(url);
      host = u.hostname || host;
      port = Number(u.port || 6379);
    } catch {
      /* use defaults */
    }
    return new Promise((resolve) => {
      const socket = net.connect({ host, port });
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        socket.removeAllListeners();
        socket.destroy();
        resolve(ok);
      };
      socket.setTimeout(800);
      socket.once("connect", () => done(true));
      socket.once("timeout", () => done(false));
      socket.once("error", () => done(false));
    });
  }

  /** Only called after probeRedis() confirms Redis is up. */
  private async startBullMq(): Promise<void> {
    const url = process.env.REDIS_URL as string;
    const { Queue, Worker } = await import("bullmq");
    const IORedis = (await import("ioredis")).default;
    const connection = new IORedis(url, { maxRetriesPerRequest: null });
    connection.on("error", () => {}); // swallow late errors, never spam
    const conn = connection as unknown as import("bullmq").ConnectionOptions;
    this.queue = new Queue("verdant-triggers", { connection: conn });
    this.worker = new Worker(
      "verdant-triggers",
      async (job) => {
        await this.fire(job.data.id as string).catch(() => {});
      },
      { connection: conn },
    );
  }
}

function cryptoToken(): string {
  return Array.from({ length: 24 }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)],
  ).join("");
}

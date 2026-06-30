import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import { RuntimeService } from "../runtime/runtime.service";
import {
  AgentsService,
  DEFAULT_SETTINGS,
  type AgentConfigInput,
  type AgentPatch,
  type AgentSettings,
} from "./agents.service";
import { UsersService } from "../users/users.service";
import { sseFrame, type RunEvent } from "../streaming/contract";
import { agents } from "../db/schema";

const runSchema = z.object({
  message: z.string().min(1).max(8000),
  sessionId: z.string().uuid().optional(),
  model: z.string().optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  instructions: z.string().max(8000).optional(),
  modelMode: z.enum(["auto", "manual"]).optional(),
  modelId: z.string().max(160).nullable().optional(),
  favorite: z.boolean().optional(),
});

const settingsSchema = z.object({
  triggers: z.object({
    run: z.boolean(),
    newChat: z.boolean(),
    mention: z.boolean(),
  }),
  webAccess: z.boolean(),
  trustedUrls: z.array(z.string().max(200)).max(100),
  allowAllUrls: z.boolean(),
});

const saveSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(400).nullable().optional(),
  instructions: z.string().max(8000).nullable().optional(),
  modelMode: z.enum(["auto", "manual"]),
  modelId: z.string().max(160).nullable().optional(),
  settings: settingsSchema,
});

function toView(a: typeof agents.$inferSelect) {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    icon: a.icon,
    greeting: a.greeting,
    instructions: a.instructions,
    modelMode: a.modelMode,
    modelId: a.modelId,
    maxSteps: a.maxSteps,
    favorite: a.favorite,
    settings: (a.settingsJson as AgentSettings) ?? DEFAULT_SETTINGS,
  };
}

@Controller("agents")
export class AgentsController {
  constructor(
    private readonly runtime: RuntimeService,
    private readonly agents: AgentsService,
    private readonly users: UsersService,
  ) {}

  @Get("current")
  async current() {
    const userId = await this.users.getCurrentUserId();
    return toView(await this.agents.getOrCreateDefault(userId));
  }

  @Get(":id/export")
  async export(@Param("id") id: string) {
    const userId = await this.users.getCurrentUserId();
    const a = await this.agents.get(userId, id);
    if (!a) throw new NotFoundException("Agent not found");
    return toView(a);
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: unknown) {
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message));
    }
    const userId = await this.users.getCurrentUserId();
    return toView(await this.agents.update(userId, id, parsed.data as AgentPatch));
  }

  @Post(":id/save")
  async save(@Param("id") id: string, @Body() body: unknown) {
    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message));
    }
    const userId = await this.users.getCurrentUserId();
    return toView(
      await this.agents.saveConfig(userId, id, parsed.data as AgentConfigInput),
    );
  }

  @Post(":id/duplicate")
  async duplicate(@Param("id") id: string) {
    const userId = await this.users.getCurrentUserId();
    return toView(await this.agents.duplicate(userId, id));
  }

  @Post(":id/draft-instructions")
  async draftInstructions(@Param("id") _id: string, @Body() body: unknown) {
    const parsed = z
      .object({ description: z.string().min(3).max(2000) })
      .safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message));
    }
    const instructions = await this.runtime.draftInstructions(parsed.data.description);
    return { instructions };
  }

  @Post(":id/reset")
  async reset(@Param("id") id: string) {
    const userId = await this.users.getCurrentUserId();
    return toView(await this.agents.reset(userId, id));
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    const userId = await this.users.getCurrentUserId();
    return this.agents.remove(userId, id);
  }

  @Post(":id/run")
  async run(@Param("id") id: string, @Body() body: unknown, @Res() res: Response) {
    const parsed = runSchema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues.map((i) => i.message) });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    (res as unknown as { flushHeaders?: () => void }).flushHeaders?.();

    const send = (e: RunEvent) => res.write(sseFrame(e));
    try {
      await this.runtime.run(
        {
          agentId: id,
          message: parsed.data.message,
          sessionId: parsed.data.sessionId,
          model: parsed.data.model,
        },
        send,
      );
    } catch (err) {
      send({
        type: "error",
        message: err instanceof Error ? err.message : "Run failed",
      });
    } finally {
      res.end();
    }
  }
}

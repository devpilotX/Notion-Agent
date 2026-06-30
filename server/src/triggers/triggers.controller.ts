import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { z } from "zod";
import { TriggersService, type TriggerConfig, type TriggerType } from "./triggers.service";

const configSchema = z.object({
  cron: z.string().max(120).optional(),
  intervalSec: z.number().int().min(1).max(86400).optional(),
  path: z.string().max(400).optional(),
  token: z.string().max(80).optional(),
  address: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
});

const createSchema = z.object({
  type: z.enum(["scheduled", "webhook", "email", "file", "manual", "mention"]),
  config: configSchema.default({}),
});

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  config: configSchema.optional(),
});

@Controller("triggers")
export class TriggersController {
  constructor(private readonly triggers: TriggersService) {}

  @Get()
  list() {
    return this.triggers.list();
  }

  @Post()
  create(@Body() body: unknown) {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message));
    }
    return this.triggers.create(
      parsed.data.type as TriggerType,
      parsed.data.config as TriggerConfig,
    );
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown) {
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message));
    }
    return this.triggers.update(id, parsed.data as { enabled?: boolean; config?: TriggerConfig });
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.triggers.remove(id);
  }

  /** Manually fire a trigger now (used by the UI "Run now" and for verification). */
  @Post(":id/fire")
  fire(@Param("id") id: string, @Body() body: { message?: string }) {
    return this.triggers.fire(id, body?.message);
  }

  /** Inbound webhook endpoint. POST here with the trigger's token to fire it. */
  @Post("webhook/:token")
  webhook(@Param("token") token: string, @Body() body: { message?: string }) {
    return this.triggers.fireWebhook(token, body?.message);
  }
}

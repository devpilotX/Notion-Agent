import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from "@nestjs/common";
import { z } from "zod";
import { ConnectionsService, type McpConfig } from "./connections.service";

const authSchema = z.union([
  z.object({ type: z.literal("none") }),
  z.object({
    type: z.literal("bearer"),
    token: z.string().min(1).max(2000),
    prefix: z.enum(["Bearer", "Token"]).optional(),
  }),
  z.object({
    type: z.literal("basic"),
    username: z.string().max(200),
    password: z.string().max(400),
  }),
  z.object({
    type: z.literal("apikey"),
    headerName: z.string().min(1).max(100),
    headerValue: z.string().min(1).max(2000),
  }),
]);

const createSchema = z.object({
  name: z.string().max(80).optional(),
  transport: z.enum(["stdio", "http"]).optional(),
  command: z.string().max(200).optional(),
  args: z.array(z.string().max(400)).max(40).optional(),
  env: z.record(z.string()).optional(),
  url: z.string().url().optional(),
  auth: authSchema.optional(),
  headers: z.record(z.string()).optional(),
  timeoutMs: z.number().int().min(1000).max(120000).optional(),
});

@Controller("connections")
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Get()
  list() {
    return this.connections.list();
  }

  @Post()
  create(@Body() body: unknown) {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message));
    }
    return this.connections.create(parsed.data as McpConfig);
  }

  @Post(":id/test")
  test(@Param("id") id: string) {
    return this.connections.test(id);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.connections.remove(id);
  }
}

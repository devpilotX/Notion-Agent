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
import { KeysService } from "./keys.service";

const createKeySchema = z.object({
  provider: z.enum([
    "openai",
    "anthropic",
    "mistral",
    "google",
    "groq",
    "openrouter",
    "xai",
    "deepseek",
    "cohere",
    "together",
  ]),
  label: z.string().min(1).max(80),
  secret: z.string().min(8).max(400),
  baseUrl: z.string().url().optional(),
});

const rotateKeySchema = z.object({
  secret: z.string().min(8).max(400),
});

function parse<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException(result.error.issues.map((i) => i.message));
  }
  return result.data;
}

@Controller("keys")
export class KeysController {
  constructor(private readonly keys: KeysService) {}

  @Get()
  list() {
    return this.keys.list();
  }

  @Post()
  create(@Body() body: unknown) {
    return this.keys.create(parse(createKeySchema, body));
  }

  @Post("detect")
  detect(@Body() body: unknown) {
    const { secret } = parse(z.object({ secret: z.string().min(1).max(400) }), body);
    return this.keys.detect(secret);
  }

  @Post(":id/validate")
  validate(@Param("id") id: string) {
    return this.keys.validate(id);
  }

  @Post(":id/rotate")
  rotate(@Param("id") id: string, @Body() body: unknown) {
    return this.keys.rotate(id, parse(rotateKeySchema, body).secret);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.keys.remove(id);
  }
}

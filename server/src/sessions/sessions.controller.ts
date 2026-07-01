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
import { SessionsService } from "./sessions.service";

const renameSchema = z.object({
  title: z.string().min(1).max(120),
});

@Controller("sessions")
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  list() {
    return this.sessions.list();
  }

  @Post()
  create() {
    return this.sessions.create();
  }

  @Get(":id/messages")
  messages(@Param("id") id: string) {
    return this.sessions.messages(id);
  }

  @Patch(":id")
  rename(@Param("id") id: string, @Body() body: unknown) {
    const parsed = renameSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => i.message));
    }
    return this.sessions.rename(id, parsed.data.title.trim());
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.sessions.remove(id);
  }
}

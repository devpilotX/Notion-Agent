import { Controller, Get, Param, Post } from "@nestjs/common";
import { SessionsService } from "./sessions.service";

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
}

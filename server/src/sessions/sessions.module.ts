import { Module } from "@nestjs/common";
import { SessionsController } from "./sessions.controller";
import { SessionsService } from "./sessions.service";
import { UsersModule } from "../users/users.module";
import { AgentsModule } from "../agents/agents.module";

@Module({
  imports: [UsersModule, AgentsModule],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}

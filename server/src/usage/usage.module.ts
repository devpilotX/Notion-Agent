import { Module } from "@nestjs/common";
import { UsageController } from "./usage.controller";
import { UsageService } from "./usage.service";
import { UsersModule } from "../users/users.module";
import { AgentsModule } from "../agents/agents.module";

@Module({
  imports: [UsersModule, AgentsModule],
  controllers: [UsageController],
  providers: [UsageService],
})
export class UsageModule {}

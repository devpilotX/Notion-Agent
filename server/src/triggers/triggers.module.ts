import { Module } from "@nestjs/common";
import { TriggersController } from "./triggers.controller";
import { TriggersService } from "./triggers.service";
import { RuntimeService } from "../runtime/runtime.service";
import { UsersModule } from "../users/users.module";
import { AgentsModule } from "../agents/agents.module";
import { RagModule } from "../rag/rag.module";
import { ConnectionsModule } from "../connections/connections.module";

@Module({
  imports: [UsersModule, AgentsModule, RagModule, ConnectionsModule],
  controllers: [TriggersController],
  providers: [TriggersService, RuntimeService],
})
export class TriggersModule {}

import { Module } from "@nestjs/common";
import { AgentsController } from "./agents.controller";
import { AgentsService } from "./agents.service";
import { RuntimeService } from "../runtime/runtime.service";
import { UsersModule } from "../users/users.module";
import { RagModule } from "../rag/rag.module";
import { ConnectionsModule } from "../connections/connections.module";

@Module({
  imports: [UsersModule, RagModule, ConnectionsModule],
  controllers: [AgentsController],
  providers: [AgentsService, RuntimeService],
  exports: [AgentsService],
})
export class AgentsModule {}

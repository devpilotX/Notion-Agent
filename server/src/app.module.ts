import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DbModule } from "./db/db.module";
import { AuthModule } from "./auth/auth.module";
import { CryptoModule } from "./crypto/crypto.module";
import { KeysModule } from "./keys/keys.module";
import { ModelsModule } from "./models/models.module";
import { AgentsModule } from "./agents/agents.module";
import { SessionsModule } from "./sessions/sessions.module";
import { UsageModule } from "./usage/usage.module";
import { TriggersModule } from "./triggers/triggers.module";
import { RagModule } from "./rag/rag.module";
import { ConnectionsModule } from "./connections/connections.module";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Load server/.env first, then fall back to the repo-root .env.
      envFilePath: [".env", "../.env"],
    }),
    DbModule,
    AuthModule,
    CryptoModule,
    KeysModule,
    ModelsModule,
    AgentsModule,
    SessionsModule,
    UsageModule,
    TriggersModule,
    RagModule,
    ConnectionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

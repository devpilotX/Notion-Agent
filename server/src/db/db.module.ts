import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createDb, dbConnectionFromEnv, type Database } from "./drizzle";

/** Injection token for the Drizzle database instance. */
export const DRIZZLE = "DRIZZLE";

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      // ConfigService dependency guarantees env is loaded before we read it.
      inject: [ConfigService],
      useFactory: (_config: ConfigService): Database => {
        return createDb(dbConnectionFromEnv(process.env));
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DbModule {}

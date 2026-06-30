import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CryptoService } from "./crypto.service";

@Global()
@Module({
  providers: [
    {
      provide: CryptoService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new CryptoService(config.getOrThrow<string>("MASTER_ENCRYPTION_KEY")),
    },
  ],
  exports: [CryptoService],
})
export class CryptoModule {}

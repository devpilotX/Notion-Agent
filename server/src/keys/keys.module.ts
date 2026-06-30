import { Module } from "@nestjs/common";
import { KeysController } from "./keys.controller";
import { KeysService } from "./keys.service";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [UsersModule],
  controllers: [KeysController],
  providers: [KeysService],
})
export class KeysModule {}

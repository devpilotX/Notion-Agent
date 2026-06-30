import { Controller, Get } from "@nestjs/common";
import { ModelsService } from "./models.service";

@Controller("models")
export class ModelsController {
  constructor(private readonly models: ModelsService) {}

  @Get()
  list() {
    return this.models.list();
  }

  @Get("auto")
  auto() {
    return this.models.autoChoice();
  }
}

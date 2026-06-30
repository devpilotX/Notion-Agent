import { Controller, Get } from "@nestjs/common";
import { UsageService } from "./usage.service";

@Controller("usage")
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  @Get()
  get() {
    return this.usage.get();
  }
}

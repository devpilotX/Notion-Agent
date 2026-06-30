import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const allowed = (config.get<string>("CORS_ORIGINS") ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const isProd =
    (config.get<string>("NODE_ENV") ?? process.env.NODE_ENV) === "production";
  // Any localhost / 127.0.0.1 port is fine in development (the dev server may
  // land on 3001 if 3000 is taken). Production uses the explicit allowlist.
  const localhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

  app.enableCors({
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return cb(null, true); // curl, server-to-server, same-origin
      if (allowed.includes(origin)) return cb(null, true);
      if (!isProd && localhost.test(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  });

  const port = Number(config.get("API_PORT") ?? 4000);
  await app.listen(port);
  console.log(`Verdant engine listening on http://localhost:${port}`);
}

void bootstrap();

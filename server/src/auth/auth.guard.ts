import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";
import { readCookie } from "./auth.util";
import { SESSION_COOKIE } from "./auth.controller";

/** Endpoints reachable without a session when auth is enabled. */
function isPublic(method: string, path: string): boolean {
  if (path === "/health") return true;
  if (path === "/auth/me" && method === "GET") return true; // reports authRequired
  if (path === "/auth/signin" || path === "/auth/signup" || path === "/auth/signout") {
    return true;
  }
  // Inbound webhooks authenticate with their own secret token and run as the
  // trigger owner. Everything else under /auth (PATCH me, change-password)
  // needs a session like any other route.
  return path.startsWith("/triggers/webhook/");
}

/**
 * Global gate. When AUTH_ENABLED is off it does nothing, preserving the
 * single-user local mode. When on, it binds the session user to the request
 * context whenever a valid cookie is present, and rejects everything outside
 * the public allowlist without one.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.auth.enabled) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path ?? req.url ?? "";

    // Bind the user first so even public routes see the right identity.
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    const userId = token ? this.auth.userIdFromToken(token) : null;
    if (userId) this.users.bindUser(userId);

    if (isPublic(req.method, path)) return true;
    if (!userId) throw new UnauthorizedException("Sign in required.");
    return true;
  }
}

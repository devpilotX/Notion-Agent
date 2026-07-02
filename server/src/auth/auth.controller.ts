import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";
import { readCookie } from "./auth.util";

export const SESSION_COOKIE = "verdant_session";

const signupSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(80).optional(),
});
const signinSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});
const nameSchema = z.object({ name: z.string().min(1).max(80) });
const passwordSchema = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(8).max(200),
});

function parse<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw new BadRequestException(r.error.issues.map((i) => i.message));
  return r.data;
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  private setSession(res: Response, userId: string) {
    // secure=true only makes sense behind HTTPS; opt in when deployed.
    const secure = (process.env.AUTH_COOKIE_SECURE ?? "").toLowerCase() === "true";
    res.cookie(SESSION_COOKIE, this.auth.issueToken(userId), {
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
    });
  }

  /** Who am I? Also tells the UI whether sign-in is required at all. */
  @Get("me")
  async me(@Req() req: Request) {
    if (!this.auth.enabled) return { authRequired: false, user: null };
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    const userId = token ? this.auth.userIdFromToken(token) : null;
    const user = userId ? await this.auth.me(userId) : null;
    return { authRequired: true, user };
  }

  @Post("signup")
  async signup(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    if (!this.auth.enabled) throw new BadRequestException("Auth is not enabled on this engine.");
    const input = parse(signupSchema, body);
    const user = await this.auth.signup(input.email, input.password, input.name);
    this.setSession(res, user.id);
    return { user };
  }

  @Post("signin")
  async signin(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    if (!this.auth.enabled) throw new BadRequestException("Auth is not enabled on this engine.");
    const input = parse(signinSchema, body);
    const user = await this.auth.signin(input.email, input.password);
    this.setSession(res, user.id);
    return { user };
  }

  @Post("signout")
  signout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  }

  @Patch("me")
  async updateName(@Body() body: unknown) {
    const { name } = parse(nameSchema, body);
    const userId = await this.users.getCurrentUserId();
    return { user: await this.auth.updateName(userId, name) };
  }

  @Post("change-password")
  async changePassword(@Body() body: unknown) {
    const input = parse(passwordSchema, body);
    const userId = await this.users.getCurrentUserId();
    await this.auth.changePassword(userId, input.current, input.next);
    return { ok: true };
  }
}

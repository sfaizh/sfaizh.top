import { Body, Controller, Get, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import type { AuthSession } from '@sfaizh/shared';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: { password?: string }): AuthSession {
    return this.auth.login(body?.password);
  }

  /** Cheap "is my stored token still good?" probe for the admin console. */
  @Get('session')
  @UseGuards(AuthGuard)
  session(): { ok: true } {
    return { ok: true };
  }
}

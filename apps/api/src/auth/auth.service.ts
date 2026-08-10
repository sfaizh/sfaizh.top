import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import type { AuthSession } from '@sfaizh/shared';
import { API_CONFIG, type ApiConfig } from '../config/config';

/**
 * Session tokens are HMAC-signed JSON, not JWTs.
 *
 * There is exactly one user and no third party consumes these tokens, so a
 * signed `{sub, exp}` blob is sufficient and removes a dependency (and its
 * decorator-metadata requirements) from the serverless bundle.
 */
@Injectable()
export class AuthService {
  constructor(@Inject(API_CONFIG) private readonly config: ApiConfig) {}

  /** Derive the value that belongs in `ADMIN_PASSWORD_HASH`. */
  static hashPassword(password: string, secret: string): string {
    return scryptSync(password, `sfaizh:${secret}`, 32).toString('hex');
  }

  get enabled(): boolean {
    const { secret, passwordHash, password } = this.config.auth;
    return Boolean(secret) && Boolean(passwordHash ?? password);
  }

  login(password: unknown): AuthSession {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'Admin console is not configured. Set AUTH_SECRET and ADMIN_PASSWORD_HASH.'
      );
    }
    if (typeof password !== 'string' || password.length === 0) {
      throw new UnauthorizedException('Password required');
    }
    if (!this.verifyPassword(password)) {
      throw new UnauthorizedException('Incorrect password');
    }

    const expiresAt = Math.floor(Date.now() / 1000) + this.config.auth.ttlSeconds;
    return { token: this.sign({ sub: 'admin', exp: expiresAt }), expiresAt };
  }

  private verifyPassword(candidate: string): boolean {
    const { passwordHash, password, secret } = this.config.auth;

    if (passwordHash) {
      const expected = Buffer.from(passwordHash, 'hex');
      const actual = Buffer.from(AuthService.hashPassword(candidate, secret), 'hex');
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    }
    if (password) {
      const expected = Buffer.from(password, 'utf8');
      const actual = Buffer.from(candidate, 'utf8');
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    }
    return false;
  }

  private sign(payload: { sub: string; exp: number }): string {
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = createHmac('sha256', this.config.auth.secret).update(body).digest('base64url');
    return `${body}.${signature}`;
  }

  /** Returns the session payload, or throws. Used by {@link AuthGuard}. */
  verify(token: string | undefined): { sub: string; exp: number } {
    if (!this.enabled) throw new UnauthorizedException('Admin console is not configured');
    if (!token) throw new UnauthorizedException('Missing session token');

    const [body, signature] = token.split('.');
    if (!body || !signature) throw new UnauthorizedException('Malformed session token');

    const expected = createHmac('sha256', this.config.auth.secret).update(body).digest('base64url');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid session token');
    }

    let payload: { sub: string; exp: number };
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Invalid session token');
    }
    if (!payload?.exp || payload.exp * 1000 < Date.now()) {
      throw new UnauthorizedException('Session expired');
    }
    return payload;
  }
}

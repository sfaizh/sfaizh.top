import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';

/**
 * Bearer-token guard for every `/admin` route. The token is also accepted from
 * the `x-admin-token` header so the editor's `fetch` calls stay simple.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    const bearer = header?.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : undefined;
    const token = bearer ?? (request.headers['x-admin-token'] as string | undefined);

    const session = this.auth.verify(token);
    (request as Request & { session?: unknown }).session = session;
    return true;
  }
}

/** Non-throwing variant used by public routes that reveal drafts when signed in. */
@Injectable()
export class OptionalAuth {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  isAuthenticated(request: Request): boolean {
    try {
      const header = request.headers.authorization;
      const bearer = header?.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : undefined;
      this.auth.verify(bearer ?? (request.headers['x-admin-token'] as string | undefined));
      return true;
    } catch {
      return false;
    }
  }
}

import { UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { loadConfig, type ApiConfig } from '../config/config';

const SECRET = 'test-secret';
const PASSWORD = 'correct horse battery staple';

function configWith(overrides: Partial<ApiConfig['auth']> = {}): ApiConfig {
  const base = loadConfig({ NODE_ENV: 'test' } as NodeJS.ProcessEnv);
  return {
    ...base,
    auth: {
      secret: SECRET,
      passwordHash: AuthService.hashPassword(PASSWORD, SECRET),
      password: null,
      ttlSeconds: 3600,
      ...overrides,
    },
  };
}

describe('AuthService', () => {
  it('issues a token for the correct password', () => {
    const service = new AuthService(configWith());
    const session = service.login(PASSWORD);

    expect(session.token).toMatch(/^[\w-]+\.[\w-]+$/);
    expect(session.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(service.verify(session.token).sub).toBe('admin');
  });

  it('rejects the wrong password', () => {
    const service = new AuthService(configWith());
    expect(() => service.login('wrong')).toThrow(UnauthorizedException);
  });

  it('rejects a missing password', () => {
    const service = new AuthService(configWith());
    expect(() => service.login(undefined)).toThrow(UnauthorizedException);
    expect(() => service.login(123)).toThrow(UnauthorizedException);
  });

  it('accepts a plaintext password when no hash is configured', () => {
    const service = new AuthService(configWith({ passwordHash: null, password: 'plain' }));
    expect(service.login('plain').token).toBeTruthy();
    expect(() => service.login('other')).toThrow(UnauthorizedException);
  });

  it('refuses to run at all when nothing is configured', () => {
    const service = new AuthService(configWith({ passwordHash: null, password: null }));
    expect(service.enabled).toBe(false);
    expect(() => service.login(PASSWORD)).toThrow(ServiceUnavailableException);
  });

  it('rejects a tampered payload', () => {
    const service = new AuthService(configWith());
    const [, signature] = service.login(PASSWORD).token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ sub: 'admin', exp: 2 ** 40 })).toString('base64url')}.${signature}`;

    expect(() => service.verify(forged)).toThrow(UnauthorizedException);
  });

  it('rejects a token signed with a different secret', () => {
    const mine = new AuthService(configWith());
    const theirs = new AuthService(configWith({ secret: 'another-secret', passwordHash: AuthService.hashPassword(PASSWORD, 'another-secret') }));

    expect(() => mine.verify(theirs.login(PASSWORD).token)).toThrow(UnauthorizedException);
  });

  it('rejects an expired token', () => {
    const service = new AuthService(configWith({ ttlSeconds: -10 }));
    expect(() => service.verify(service.login(PASSWORD).token)).toThrow(/expired/i);
  });

  it('rejects malformed tokens', () => {
    const service = new AuthService(configWith());
    expect(() => service.verify('')).toThrow(/Missing session token/);
    expect(() => service.verify('nodot')).toThrow(/Malformed/);
    expect(() => service.verify('a.b')).toThrow(UnauthorizedException);
  });

  it('derives a stable hash for a password and secret', () => {
    expect(AuthService.hashPassword(PASSWORD, SECRET)).toBe(AuthService.hashPassword(PASSWORD, SECRET));
    expect(AuthService.hashPassword(PASSWORD, SECRET)).not.toBe(AuthService.hashPassword(PASSWORD, 'other'));
  });
});

describe('loadConfig', () => {
  it('reports Supabase as unconfigured without credentials', () => {
    const config = loadConfig({ NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    expect(config.supabase).toBeNull();
    expect(config.warnings.join(' ')).toContain('Supabase is not configured');
  });

  it('picks up Supabase credentials when both are present', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    } as NodeJS.ProcessEnv);

    expect(config.supabase).toEqual({
      url: 'https://project.supabase.co',
      serviceKey: 'service-key',
      table: 'posts',
    });
  });

  it('warns loudly when production is missing its secrets', () => {
    const config = loadConfig({ NODE_ENV: 'production' } as NodeJS.ProcessEnv);
    expect(config.auth.password).toBeNull();
    expect(config.warnings.join(' ')).toContain('AUTH_SECRET is not set in production');
  });

  it('provides a development password only outside production', () => {
    expect(loadConfig({ NODE_ENV: 'development' } as NodeJS.ProcessEnv).auth.password).toBe('catppuccin');
  });
});

/**
 * Configuration is a plain value, not a decorator-driven module.
 *
 * The API is mounted in-process by the Next.js app, which means it is compiled
 * by SWC rather than `tsc`. Anything that depends on `emitDecoratorMetadata`
 * is a liability there, so config is loaded eagerly and injected by token.
 */

export const API_CONFIG = 'API_CONFIG';

export interface SupabaseConfig {
  url: string;
  serviceKey: string;
  table: string;
}

export interface BlobConfig {
  token: string;
  prefix: string;
}

export interface AuthConfig {
  secret: string;
  /** scrypt(password, secret) as hex. Preferred over a plaintext password. */
  passwordHash: string | null;
  /** Plaintext fallback for local development only. */
  password: string | null;
  ttlSeconds: number;
}

export interface ApiConfig {
  supabase: SupabaseConfig | null;
  blob: BlobConfig | null;
  auth: AuthConfig;
  isProduction: boolean;
  /** Set when the deployment is missing something it needs in production. */
  warnings: string[];
}

const DEV_AUTH_SECRET = 'dev-secret-not-for-production';
const DEV_PASSWORD = 'catppuccin';

function trimmed(value: string | undefined): string | null {
  const result = (value ?? '').trim();
  return result === '' ? null : result;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const isProduction = env.NODE_ENV === 'production';
  const warnings: string[] = [];

  const supabaseUrl = trimmed(env.SUPABASE_URL);
  const supabaseKey = trimmed(env.SUPABASE_SERVICE_ROLE_KEY);
  const supabase =
    supabaseUrl && supabaseKey
      ? { url: supabaseUrl, serviceKey: supabaseKey, table: trimmed(env.SUPABASE_POSTS_TABLE) ?? 'posts' }
      : null;
  if (!supabase) {
    warnings.push('Supabase is not configured — posts are served read-only from the bundled markdown.');
  }

  const blobToken = trimmed(env.BLOB_READ_WRITE_TOKEN);
  const blob = blobToken ? { token: blobToken, prefix: trimmed(env.BLOB_PREFIX) ?? 'blog' } : null;
  if (!blob) {
    warnings.push('BLOB_READ_WRITE_TOKEN is not set — image uploads are disabled.');
  }

  const secret = trimmed(env.AUTH_SECRET);
  if (!secret && isProduction) {
    warnings.push('AUTH_SECRET is not set in production — the admin console is disabled.');
  }

  const passwordHash = trimmed(env.ADMIN_PASSWORD_HASH);
  const password = trimmed(env.ADMIN_PASSWORD);
  if (!passwordHash && !password && isProduction) {
    warnings.push('ADMIN_PASSWORD_HASH is not set in production — the admin console is disabled.');
  }

  return {
    supabase,
    blob,
    auth: {
      secret: secret ?? (isProduction ? '' : DEV_AUTH_SECRET),
      passwordHash,
      password: password ?? (isProduction ? null : DEV_PASSWORD),
      ttlSeconds: Number(env.AUTH_TTL_SECONDS ?? 60 * 60 * 8),
    },
    isProduction,
    warnings,
  };
}

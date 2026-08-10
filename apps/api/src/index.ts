import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Logger } from '@nestjs/common';
import express, { type Express } from 'express';
import { API_PREFIX, API_ROUTES } from '@sfaizh/shared';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { API_CONFIG, type ApiConfig } from './config/config';

export { AppModule } from './app.module';
export { loadConfig, API_CONFIG, type ApiConfig } from './config/config';
export { AuthService } from './auth/auth.service';
export { PostsService } from './content/posts.service';

/**
 * Builds the Express instance that Nest is bound to.
 *
 * The same instance is used two ways: `main.ts` listens on it for `nx serve
 * api`, and the Next.js app hands requests to it directly from a Pages Router
 * API route so that a single Vercel deployment serves both halves of the site.
 */
export async function createExpressApp(): Promise<Express> {
  const server = express();

  // Body parsing is configured by hand: the media route needs the raw bytes,
  // everything else wants JSON. Nest's built-in parser would eat the image.
  server.use(API_ROUTES.adminUpload, express.raw({ type: '*/*', limit: '6mb' }));
  server.use(express.json({ limit: '2mb' }));

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    // Silent under test so a suite's output is its assertions, not a boot log.
    logger:
      process.env.NODE_ENV === 'test'
        ? false
        : process.env.NODE_ENV === 'production'
          ? ['error', 'warn']
          : ['error', 'warn', 'log'],
    bodyParser: false,
  });

  app.setGlobalPrefix(API_PREFIX.replace(/^\//, ''));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const config = app.get<ApiConfig>(API_CONFIG);
  for (const warning of config.warnings) {
    new Logger('api').warn(warning);
  }

  await app.init();
  return server;
}

let cached: Promise<Express> | null = null;

/**
 * Memoised across warm serverless invocations — bootstrapping Nest on every
 * request would add hundreds of milliseconds to each terminal command.
 */
export function getExpressApp(): Promise<Express> {
  cached ??= createExpressApp();
  return cached;
}

/** Test helper: forget the cached instance so env changes take effect. */
export function resetExpressApp(): void {
  cached = null;
}

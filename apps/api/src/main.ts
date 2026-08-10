import { Logger } from '@nestjs/common';
import { API_PREFIX } from '@sfaizh/shared';
import { createExpressApp } from './index';

/**
 * Standalone entry point (`npx nx serve api`). Useful when working on the
 * backend alone; in production the Next.js app mounts the same Express
 * instance in-process instead of talking to this server.
 */
async function bootstrap(): Promise<void> {
  const server = await createExpressApp();
  const port = Number(process.env.PORT ?? 3333);

  server.listen(port, () => {
    Logger.log(`API listening on http://localhost:${port}${API_PREFIX}`, 'api');
  });
}

bootstrap().catch((error) => {
  Logger.error(error instanceof Error ? error.stack : String(error), 'api');
  process.exitCode = 1;
});

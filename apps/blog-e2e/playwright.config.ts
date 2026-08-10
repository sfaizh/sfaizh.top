import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

const baseURL = process.env['BASE_URL'] || 'http://localhost:3000';

/**
 * The e2e suite drives a production build, because the boot sequence, the
 * mounted NestJS API and the reader's keyboard handling are all things that
 * only behave identically once compiled. Chromium covers the desktop grammar;
 * a Pixel profile covers the touch path, which is a different UI rather than a
 * narrower one.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run e2e:serve',
    url: 'http://localhost:3000/api/v1/health',
    reuseExistingServer: !process.env.CI,
    cwd: workspaceRoot,
    timeout: 180_000,
  },
  projects: [
    // The mobile suite is a different UI, not a narrower one, so the desktop
    // project skips it rather than running it at a desktop viewport.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 5'] }, testMatch: /mobile\.spec\.ts/ },
  ],
});

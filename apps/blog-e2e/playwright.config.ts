import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

const baseURL = process.env['BASE_URL'] || 'http://localhost:3000';

/**
 * Escape hatch for machines where `playwright install` cannot fetch a browser
 * (locked-down networks, sandboxes). Point it at any Chromium-based binary:
 *
 *   PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/google-chrome npm run e2e
 *
 * CI leaves it unset and uses the browser Playwright installs itself.
 */
const executablePath = process.env['PLAYWRIGHT_CHROMIUM_PATH'];

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
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  // A crashed browser worker should not fail the pipeline; a real regression
  // fails all attempts.
  retries: process.env['CI'] ? 2 : 0,

  // Serial on purpose. The suite is small enough to finish in a few seconds,
  // and running several emulated-device contexts at once on a constrained
  // machine makes device emulation itself unreliable — which shows up as the
  // touch UI intermittently not appearing. Parallelism here buys nothing and
  // costs determinism.
  workers: 1,

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

import { expect, test, type Page } from '@playwright/test';

/**
 * The desktop journey: boot once, drive the shell, open a post in the pager,
 * move around with vim motions, come back.
 */

/** Skip the boot animation the way a returning visitor would. */
async function bootedPage(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('sfaizh:boot:v1', '1');
  });
  await page.goto('/');
  await expect(page.getByLabel('Terminal input')).toBeAttached();
}

async function run(page: Page, command: string) {
  const input = page.getByLabel('Terminal input');
  await input.fill(command);
  await input.press('Enter');
}

test.describe('boot sequence', () => {
  test('plays on the first visit and is skippable', async ({ page }) => {
    await page.goto('/');

    // Assert on the boot surface rather than one of its lines: the lines each
    // appear on their own timer and the whole sequence removes itself after a
    // couple of seconds, which makes any single line a race on a slow runner.
    const booting = page.getByLabel('Booting');
    await expect(booting).toBeVisible();

    await page.keyboard.press('Space');

    await expect(booting).toHaveCount(0);
    await expect(page.getByLabel('Terminal input')).toBeAttached();
  });

  test('does not play again once it has run', async ({ page }) => {
    await bootedPage(page);
    await expect(page.getByText('Reading package lists... Done')).toHaveCount(0);
  });
});

test.describe('the shell', () => {
  test.beforeEach(async ({ page }) => bootedPage(page));

  test('greets with a banner and the statusline legend', async ({ page }) => {
    await expect(page.getByText('sfsh 1.0').first()).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'SHELL' })).toBeVisible();
  });

  test('lists the archive', async ({ page }) => {
    await run(page, 'posts');

    await expect(page.getByText('building-a-terminal-blog').first()).toBeVisible();
    await expect(page.getByText('vim-motions-as-a-design-language').first()).toBeVisible();
  });

  test('lists the virtual filesystem and changes directory', async ({ page }) => {
    await run(page, 'ls');
    await expect(page.getByText('about.md').first()).toBeVisible();

    await run(page, 'cd posts');
    await run(page, 'ls');
    await expect(page.getByText('building-a-terminal-blog.md').first()).toBeVisible();
  });

  test('reports an unknown command like a shell does', async ({ page }) => {
    await run(page, 'frobnicate');
    await expect(page.getByText('command not found: frobnicate')).toBeVisible();
  });

  test('completes a command with Tab', async ({ page }) => {
    const input = page.getByLabel('Terminal input');
    await input.fill('neo');
    await input.press('Tab');

    await expect(input).toHaveValue('neofetch ');
  });

  test('searches across posts', async ({ page }) => {
    await run(page, 'search split-flap');
    await expect(page.getByText('building-a-terminal-blog').first()).toBeVisible();
  });

  test('switches the Catppuccin flavour and remembers it', async ({ page }) => {
    await run(page, 'theme latte');
    await expect(page.locator('html')).toHaveAttribute('data-flavour', 'latte');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-flavour', 'latte');
  });

  test('remembers history across a reload', async ({ page }) => {
    await run(page, 'whoami');

    // The command is persisted by an effect, so wait for the write itself
    // rather than assuming it has happened by the time the reload lands.
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem('sfaizh:history:v1')))
      .toContain('whoami');

    await page.reload();
    await expect(page.getByText('sfsh 1.0').first()).toBeVisible();

    const input = page.getByLabel('Terminal input');
    await input.click();
    await input.press('ArrowUp');
    await expect(input).toHaveValue('whoami');
  });

  test('clears the screen', async ({ page }) => {
    await run(page, 'posts');
    await run(page, 'clear');
    await expect(page.getByText('building-a-terminal-blog')).toHaveCount(0);
  });
});

test.describe('the reader', () => {
  test.beforeEach(async ({ page }) => {
    await bootedPage(page);
    await run(page, 'open building-a-terminal-blog');
    await expect(page.getByRole('heading', { name: 'Building a terminal-shaped blog' })).toBeVisible();
  });

  test('renders the post as a document with a NORMAL statusline', async ({ page }) => {
    await expect(page.getByRole('status').filter({ hasText: 'NORMAL' })).toBeVisible();
    await expect(page.getByText('building-a-terminal-blog.md')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The three surfaces' })).toBeVisible();
  });

  test('scrolls with j and jumps with G and gg', async ({ page }) => {
    const surface = page.getByRole('document');

    await page.keyboard.press('G');
    await expect
      .poll(() => surface.evaluate((node: HTMLElement) => node.scrollTop), { timeout: 5000 })
      .toBeGreaterThan(500);

    await page.keyboard.press('g');
    await page.keyboard.press('g');
    await expect
      .poll(() => surface.evaluate((node: HTMLElement) => node.scrollTop), { timeout: 5000 })
      .toBe(0);

    await page.keyboard.press('j');
    await page.keyboard.press('j');
    await expect
      .poll(() => surface.evaluate((node: HTMLElement) => node.scrollTop), { timeout: 5000 })
      .toBeGreaterThan(0);
  });

  test('highlights matches for a / search', async ({ page }) => {
    await page.keyboard.press('/');
    await page.getByLabel('Search within the post').fill('statusline');
    await page.keyboard.press('Enter');

    await expect(page.locator('mark.reader-hit').first()).toBeAttached();
  });

  test('shows the key map for ?', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'Reader keys' })).toBeVisible();
  });

  test('returns to the shell on q', async ({ page }) => {
    await page.keyboard.press('q');
    await expect(page.getByLabel('Terminal input')).toBeAttached();
  });

  test('shows the : command line as you type and leaves on :q', async ({ page }) => {
    await page.keyboard.press(':');

    const commandLine = page.getByLabel('Reader command');
    await expect(commandLine).toBeFocused();
    await expect(page.getByRole('status').filter({ hasText: 'COMMAND' })).toBeVisible();

    await commandLine.fill('q');
    await expect(commandLine).toHaveValue('q');
    await commandLine.press('Enter');

    await expect(page.getByLabel('Terminal input')).toBeAttached();
  });

  test('reports an unknown : command instead of ignoring it', async ({ page }) => {
    await page.keyboard.press(':');
    await page.getByLabel('Reader command').fill('nonsense');
    await page.getByLabel('Reader command').press('Enter');

    await expect(page.getByText(/E492: Not an editor command: nonsense/)).toBeVisible();
    await expect(page.getByRole('document')).toBeVisible();
  });
});

test.describe('the API', () => {
  test('serves the post index', async ({ request }) => {
    const response = await request.get('/api/v1/posts');
    expect(response.ok()).toBe(true);
    expect((await response.json()).length).toBeGreaterThanOrEqual(2);
  });

  test('protects the admin routes', async ({ request }) => {
    expect((await request.get('/api/v1/admin/posts')).status()).toBe(401);
  });
});

test.describe('the admin console', () => {
  test('asks for a password', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByLabel('[sudo] password for faiz:')).toBeVisible();
  });

  test('is reachable from the terminal with sudo -i', async ({ page }) => {
    await bootedPage(page);
    await run(page, 'sudo -i');

    await expect(page).toHaveURL(/\/admin$/);
  });
});

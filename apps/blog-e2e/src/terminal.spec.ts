import { expect, test, type Page } from '@playwright/test';

/**
 * The core desktop journey: boot, drive the shell, open a post, come back.
 *
 * Deliberately small. An end-to-end suite earns its keep by proving the pieces
 * are wired together — the browser really loads, the mounted API really
 * answers, the reader really opens. Fine-grained behaviour (completion,
 * history, motions, the codec) is covered far faster and far more precisely by
 * the unit tests, and duplicating it here only buys flakiness.
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

/** Opens a post and returns the reader surface, focused and ready for keys. */
async function openPost(page: Page) {
  await run(page, 'open vim-motions-as-a-design-language');
  await expect(page.getByRole('heading', { name: 'Vim motions as a design language' })).toBeVisible();

  // Address the surface by its accessible name: a bare `getByRole('document')`
  // can resolve to the document root rather than this container. Focus it
  // explicitly — the app focuses it too, but a test that races that effect
  // sends keys into the void and fails for the wrong reason.
  const surface = page.getByRole('document', { name: /reader/ });
  await surface.focus();
  return surface;
}

test.describe('the terminal', () => {
  test('boots once, then drops straight to the prompt', async ({ page }) => {
    await page.goto('/');

    const booting = page.getByLabel('Booting');
    await expect(booting).toBeVisible();
    await page.keyboard.press('Space');
    await expect(booting).toHaveCount(0);

    await expect(page.getByLabel('Terminal input')).toBeAttached();
    await expect(page.getByText(/· engineering blog/).first()).toBeVisible();

    // Second visit: straight to the prompt, no boot sequence.
    await page.reload();
    await expect(page.getByLabel('Booting')).toHaveCount(0);
    await expect(page.getByLabel('Terminal input')).toBeAttached();
  });

  test('lists the archive', async ({ page }) => {
    await bootedPage(page);
    await run(page, 'posts');

    await expect(page.getByText('vim-motions-as-a-design-language').first()).toBeVisible();
    await expect(page.getByText('blazingly-fast-workflows-with-alacritty-nvim').first()).toBeVisible();
  });

  test('reports an unknown command like a shell does', async ({ page }) => {
    await bootedPage(page);
    await run(page, 'frobnicate');

    await expect(page.getByText('command not found: frobnicate')).toBeVisible();
  });

  test('opens the admin console with sudo -i', async ({ page }) => {
    await bootedPage(page);
    await run(page, 'sudo -i');

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByLabel('[sudo] password for faiz:')).toBeVisible();
  });
});

test.describe('the reader', () => {
  test('renders a post as a document', async ({ page }) => {
    await bootedPage(page);
    await openPost(page);

    await expect(page.getByRole('status').filter({ hasText: 'NORMAL' })).toBeVisible();
    await expect(page.getByText('vim-motions-as-a-design-language.md')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Verbs, nouns and counts' })).toBeVisible();
  });

  test('returns to the shell on q', async ({ page }) => {
    await bootedPage(page);
    await openPost(page);

    await page.keyboard.press('q');
    await expect(page.getByLabel('Terminal input')).toBeAttached();
  });

  test('shows the : command line and leaves on :q', async ({ page }) => {
    await bootedPage(page);
    await openPost(page);

    await page.keyboard.press(':');
    const commandLine = page.getByLabel('Reader command');
    await expect(commandLine).toBeFocused();

    await commandLine.fill('q');
    await expect(commandLine).toHaveValue('q');
    await commandLine.press('Enter');

    await expect(page.getByLabel('Terminal input')).toBeAttached();
  });

  test('shows a cursor that moves with j', async ({ page }) => {
    await bootedPage(page);
    await openPost(page);

    const cursor = page.locator('[data-reader-cursor]');
    await expect(cursor).toBeVisible();

    const top = async () => (await cursor.boundingBox())?.y;
    const before = await top();
    expect(before).toBeDefined();

    await page.keyboard.press('j');
    await page.keyboard.press('j');

    await expect.poll(top, { timeout: 5000 }).toBeGreaterThan(Number(before));
  });

  test('searches with / and steps through matches with n and N', async ({ page }) => {
    await bootedPage(page);
    await openPost(page);

    await page.keyboard.press('/');
    await page.getByLabel('Search within the post').fill('statusline');
    await page.getByLabel('Search within the post').press('Enter');

    const status = page.getByRole('status');
    await expect(status).toContainText('1/3');

    await page.keyboard.press('n');
    await expect(status).toContainText('2/3');

    await page.keyboard.press('N');
    await expect(status).toContainText('1/3');
  });

  test('moves the cursor with the word motions', async ({ page }) => {
    await bootedPage(page);
    await openPost(page);

    // Only that the keys are wired to the cursor. Whether `b` is the exact
    // inverse of `w` depends on where in a word the cursor started and where
    // the line happens to wrap — that belongs in the unit tests for the word
    // motions, which assert on real text offsets.
    const cursorX = async () => (await page.locator('[data-reader-cursor]').boundingBox())?.x;

    await page.keyboard.press('j');
    const start = await cursorX();

    await page.keyboard.press('w');
    await expect.poll(cursorX, { timeout: 5000 }).not.toBe(start);

    const afterWord = await cursorX();
    await page.keyboard.press('b');
    await expect.poll(cursorX, { timeout: 5000 }).not.toBe(afterWord);
  });

  test('selects a line with V and yanks it to the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await bootedPage(page);
    await openPost(page);

    await page.keyboard.press('j');
    await page.keyboard.press('V');
    await expect(page.getByRole('status').filter({ hasText: 'V-LINE' })).toBeVisible();

    await page.keyboard.press('y');

    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()), { timeout: 5000 })
      .not.toBe('');
    // Yanking leaves visual mode, as it does in Vim.
    await expect(page.getByRole('status').filter({ hasText: 'NORMAL' })).toBeVisible();
  });

  test('q cancels the search before it leaves the post', async ({ page }) => {
    await bootedPage(page);
    await openPost(page);

    await page.keyboard.press('/');
    await page.getByLabel('Search within the post').fill('statusline');
    await page.getByLabel('Search within the post').press('Enter');

    const status = page.getByRole('status');
    await expect(status).toContainText('1/3');

    // The first q drops the search but stays in the reader...
    await page.keyboard.press('q');
    await expect(status).not.toContainText('1/3');
    await expect(page.getByRole('document', { name: /reader/ })).toBeVisible();

    // ...and only the second leaves.
    await page.keyboard.press('q');
    await expect(page.getByLabel('Terminal input')).toBeAttached();
  });

  test('survives a burst of motions without a render loop', async ({ page }) => {
    // Guards a real bug: the cursor's smear scheduled a render per animation
    // frame, so React threw "Maximum update depth exceeded" and blanked the
    // page as soon as you touched a motion key.
    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(String(error)));

    await bootedPage(page);
    await openPost(page);

    for (const key of ['j', 'k', 'l', 'h', 'w', 'b', 'e', '$', '0', 'v', 'V', 'G']) {
      await page.keyboard.press(key);
    }

    expect(failures).toEqual([]);
    await expect(page.locator('[data-reader-cursor]')).toBeVisible();
  });

  test('reserves space for images so the prose cannot jump', async ({ page }) => {
    // The bug this guards: an image whose resource is unavailable — not yet
    // loaded, or evicted under memory pressure on a phone — collapsed to zero
    // height, so the text below snapped upwards and back while scrolling.
    await page.route('**/content/img/**', (route) => route.abort());
    await bootedPage(page);
    await openPost(page);

    const image = page.locator('.md-figure img').first();
    await expect(image).toBeAttached();

    const box = await image.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height ?? 0).toBeGreaterThan(80);
  });
});

test.describe('the mounted API', () => {
  test('serves the post index', async ({ request }) => {
    const response = await request.get('/api/v1/posts');

    expect(response.ok()).toBe(true);
    expect((await response.json()).length).toBeGreaterThanOrEqual(2);
  });

  test('protects the admin routes', async ({ request }) => {
    expect((await request.get('/api/v1/admin/posts')).status()).toBe(401);
  });
});

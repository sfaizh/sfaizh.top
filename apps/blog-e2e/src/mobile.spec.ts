import { expect, test, type Page } from '@playwright/test';

/**
 * The touch journey. There is no `j` key on a phone, so the mobile experience
 * is a different complete UI rather than a degraded desktop one: tappable
 * commands above the prompt, and buttons instead of motions in the reader.
 */

async function bootedPage(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('sfaizh:boot:v1', '1');
  });
  await page.goto('/');
}

test.describe('touch devices', () => {
  test.beforeEach(async ({ page }) => bootedPage(page));

  test('offers a row of predefined commands', async ({ page }) => {
    const bar = page.getByRole('navigation', { name: 'Quick commands' });

    await expect(bar).toBeVisible();
    await expect(bar.getByRole('button', { name: 'help', exact: true })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'posts', exact: true })).toBeVisible();
  });

  test('runs a command when one is tapped', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Quick commands' }).getByRole('button', { name: 'posts', exact: true }).tap();

    await expect(page.getByText('building-a-terminal-blog').first()).toBeVisible();
  });

  test('opens the latest post and offers reader controls instead of motions', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Quick commands' }).getByRole('button', { name: 'latest' }).tap();

    const controls = page.getByRole('navigation', { name: 'Reader controls' });
    await expect(controls).toBeVisible();
    await expect(controls.getByRole('button', { name: 'Jump to the end' })).toBeVisible();
  });

  test('scrolls the post with the jump buttons', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Quick commands' }).getByRole('button', { name: 'latest' }).tap();

    const surface = page.getByRole('document');
    await page.getByRole('button', { name: 'Jump to the end' }).tap();

    await expect
      .poll(() => surface.evaluate((node: HTMLElement) => node.scrollTop), { timeout: 5000 })
      .toBeGreaterThan(200);
  });

  test('closes the reader with the close control', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Quick commands' }).getByRole('button', { name: 'latest' }).tap();
    await page.getByRole('button', { name: 'Back to the terminal' }).tap();

    await expect(page.getByRole('navigation', { name: 'Quick commands' })).toBeVisible();
  });

  test('never scrolls the page body horizontally', async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

import { expect, test, type Page } from '@playwright/test';

/**
 * The core touch journey.
 *
 * There is no `j` key on a phone, so mobile is a different complete UI rather
 * than a degraded desktop one: tappable commands above the prompt, and buttons
 * instead of motions in the reader. These tests prove that alternative exists
 * and works end to end.
 */

async function bootedPage(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('sfaizh:boot:v1', '1');
  });
  await page.goto('/');

  // The input exists in every mode, so it is the signal that React has
  // hydrated. The command bar is conditional on touch detection, which only
  // resolves in an effect — asserting on it first would race hydration and
  // report "element not found" for what is really a timing problem.
  await expect(page.getByLabel('Terminal input')).toBeAttached();
  await expect(page.getByRole('navigation', { name: 'Quick commands' })).toBeVisible();
}

function quickCommand(page: Page, name: string) {
  return page
    .getByRole('navigation', { name: 'Quick commands' })
    .getByRole('button', { name, exact: true });
}

test.describe('touch devices', () => {
  test('offers predefined commands instead of a keyboard', async ({ page }) => {
    await bootedPage(page);

    await expect(quickCommand(page, 'help')).toBeVisible();
    await expect(quickCommand(page, 'posts')).toBeVisible();
  });

  test('runs a command when one is tapped', async ({ page }) => {
    await bootedPage(page);
    await quickCommand(page, 'posts').tap();

    await expect(page.getByText('vim-motions-as-a-design-language').first()).toBeVisible();
  });

  test('opens a post with reader controls, and closes again', async ({ page }) => {
    await bootedPage(page);
    await quickCommand(page, 'latest').tap();

    const controls = page.getByRole('navigation', { name: 'Reader controls' });
    await expect(controls).toBeVisible();
    await expect(controls.getByRole('button', { name: 'Jump to the end' })).toBeVisible();

    await controls.getByRole('button', { name: 'Back to the terminal' }).tap();
    await expect(page.getByRole('navigation', { name: 'Quick commands' })).toBeVisible();
  });
});

import type { Page } from '@playwright/test';

/**
 * Navigate and wait until the shell is actually interactive.
 *
 * `page.goto` resolves on `load`, which is before React has hydrated and
 * registered the global key handler. Pressing `?` in that window does nothing —
 * correctly, since nothing is listening yet. `AppShell` stamps
 * `data-hydrated` once its effect has run, so waiting on that is deterministic
 * rather than a sleep.
 */
export async function gotoApp(page: Page, path = '/') {
  await page.goto(path);
  await page.waitForSelector('html[data-hydrated="true"]', { timeout: 30_000 });
}

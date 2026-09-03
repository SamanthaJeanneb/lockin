import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers';

/** Capture → Today → complete → debrief → progress moved. The flow the product
 *  exists for, at every viewport. */
test.describe('the daily loop', () => {
  test('captures from the palette', async ({ page }) => {
    await gotoApp(page, '/');
    await page.keyboard.press('c');
    const box = page.getByPlaceholder(/Met Alex at lunch/);
    await expect(box).toBeVisible();
    await box.fill(`Playwright capture ${Date.now()}`);
    await page.keyboard.press('Enter');
    // Extraction may or may not be configured; either way the modal advances.
    await expect(page.getByRole('heading', { name: /What I found|Capture/ })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('completes a Today item, and undo puts it back', async ({ page }, testInfo) => {
    // The suite runs four viewports against one database, so the test creates
    // the row it is going to complete. Sharing a seeded task would mean
    // whichever project ran second found it already done.
    const title = `E2E complete ${testInfo.project.name} ${Date.now()}`;
    const created = await page.request.post('/api/objects', {
      // Overdue, so deadline pressure puts it at the top of the ranked list
      // regardless of what else is seeded.
      data: {
        type: 'task', title, status: 'today', area: 'career', priority: 1,
        dueAt: new Date(Date.now() - 86_400_000).toISOString(),
      },
    });
    expect(created.ok()).toBe(true);

    await gotoApp(page, '/');
    const row = page.getByRole('listitem').filter({ hasText: title });
    await expect(row).toBeVisible();

    await row.getByRole('checkbox').first().click();

    // Undo replaces confirm: the action applies immediately and offers a way back.
    const undo = page.getByRole('button', { name: 'Undo' });
    await expect(undo).toBeVisible({ timeout: 5000 });
    await undo.click();

    await expect(row).toBeVisible();
    await expect(row.getByRole('checkbox').first()).toHaveAttribute('aria-checked', 'false');

    await page.request.delete(`/api/objects/${(await created.json()).object.id}`);
  });

  test('opens the debrief and matches as you type', async ({ page }) => {
    await gotoApp(page, '/');
    await page.keyboard.press('d');
    await expect(page.getByRole('heading', { name: 'How did today go?' })).toBeVisible();

    // The manual checklist is always present, whether or not matching is
    // configured — that is the guarantee the screen makes.
    await expect(page.getByText('Or check them off yourself')).toBeVisible();

    await page
      .getByPlaceholder(/Finished the homepage/)
      .fill('Finished the portfolio homepage and pushed it live.');

    // Matching runs on a 600ms debounce; the right column fills in beside the
    // sentence that caused it. Which confidence tier a match lands in depends on
    // whether embeddings are configured — the contract is that it is tiered at
    // all, and that a mid-confidence match is left unchecked.
    // Scoped to the dialog: on a phone the debrief is a full-screen sheet and
    // the same titles also sit in the Today list behind it.
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/^(Done|Not sure)$/)).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText('Finish portfolio homepage').first()).toBeVisible();
  });
});

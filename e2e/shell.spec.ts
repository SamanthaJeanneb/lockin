import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers';

/** §2.3 of the build direction: each viewport declares how the shell degrades,
 *  and this is where that contract is enforced. */
test.describe('the shell at every width', () => {
  test('renders the right pane arrangement', async ({ page }, testInfo) => {
    await gotoApp(page, '/');
    await expect(page.getByRole('link', { name: 'Life OS' })).toBeVisible();

    const width = page.viewportSize()!.width;
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav).toBeVisible();

    if (width < 768) {
      // Phone: bottom tabs, and the capture FAB above them.
      await expect(page.getByRole('link', { name: 'More' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Capture', exact: true })).toBeVisible();
    } else if (width < 1200) {
      // Tablet and compact: the sidebar is an icon rail, so labels are hidden.
      await expect(nav.getByText('Library', { exact: true })).toBeHidden();
    } else {
      // Standard and wide: the sidebar is expanded with labels.
      await expect(nav.getByText('Library', { exact: true })).toBeVisible();
    }
  });

  test('navigates with the keyboard alone', async ({ page }) => {
    await gotoApp(page, '/');
    await page.keyboard.press('g');
    await page.keyboard.press('w');
    await expect(page).toHaveURL(/\/work\/board/);

    await page.keyboard.press('g');
    await page.keyboard.press('g');
    await expect(page).toHaveURL(/\/goals\/tree/);
  });

  test('opens and closes the command palette', async ({ page }) => {
    await gotoApp(page, '/');
    await page.keyboard.press('ControlOrMeta+k');
    const input = page.getByPlaceholder('Search, capture, or type a command…');
    await expect(input).toBeVisible();
    await input.fill('portfolio');
    await expect(page.getByText(/Capture “portfolio”/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(input).toBeHidden();
  });

  test('shows the shortcut sheet on ?', async ({ page }) => {
    await gotoApp(page, '/');
    await page.keyboard.press('?');
    await expect(page.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible();
  });
});

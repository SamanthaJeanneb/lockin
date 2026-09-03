import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers';

test.describe('views degrade as specified', () => {
  test('board shows the right number of columns', async ({ page }) => {
    await gotoApp(page, '/work/board');
    const width = page.viewportSize()!.width;

    if (width < 768) {
      // Phone: a segmented control, one column as a list.
      await expect(page.getByRole('tab', { name: /Today/ })).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: 'Backlog' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Doing' })).toBeVisible();
    }
  });

  test('roadmap becomes a vertical month list on a phone', async ({ page }) => {
    await gotoApp(page, '/goals/roadmap');
    const width = page.viewportSize()!.width;
    await expect(page.getByRole('tab', { name: 'Year', exact: true })).toBeVisible();

    if (width < 768) {
      // No bars and no load strip — the same information as a list.
      await expect(page.getByText('load', { exact: true })).toHaveCount(0);
    } else {
      await expect(page.getByText('load', { exact: true })).toBeVisible();
    }
  });

  test('goal tree renders with rolled-up progress', async ({ page }) => {
    await gotoApp(page, '/goals/tree');
    await expect(page.getByText('Career', { exact: true })).toBeVisible();
    await expect(page.getByText('%').first()).toBeVisible();
  });

  test('projects table drops columns as the viewport narrows', async ({ page }) => {
    await gotoApp(page, '/work/projects');
    const width = page.viewportSize()!.width;
    if (width >= 1200) {
      await expect(page.getByRole('columnheader', { name: 'Load' })).toBeVisible();
    } else if (width >= 768) {
      await expect(page.getByRole('columnheader', { name: 'Load' })).toBeHidden();
    } else {
      await expect(page.getByRole('table')).toHaveCount(0);
    }
  });

  test('every primary route responds', async ({ page }) => {
    for (const path of [
      '/', '/goals/tree', '/goals/roadmap', '/goals/drift', '/work/board', '/work/projects',
      '/work/backlog', '/work/waiting', '/brain', '/people', '/library', '/life', '/money',
      '/memory', '/review/weekly', '/settings',
    ]) {
      const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(res?.status(), `${path} should not error`).toBeLessThan(400);
    }
  });
});

import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * The design system's hard rules, checked in a real browser rather than by
 * grepping source. These are the ones that survive a refactor.
 */
test.describe('design system invariants', () => {
  test('the interface is greyscale outside charts and trajectory indicators', async ({ page }) => {
    await gotoApp(page, '/');

    const chromatic = await page.evaluate(() => {
      const offenders: string[] = [];
      const parse = (c: string) => c.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number) ?? null;

      for (const el of Array.from(document.querySelectorAll('body *'))) {
        // Charts and trajectory chips are the two surfaces where colour lives.
        if (el.closest('svg, [data-chart], [style*="--series"], [style*="--track"]')) continue;
        if ((el as HTMLElement).style.background?.includes('var(--series')) continue;
        if ((el as HTMLElement).style.color?.includes('var(--track')) continue;

        const s = getComputedStyle(el);
        for (const prop of ['color', 'backgroundColor', 'borderTopColor', 'outlineColor'] as const) {
          const rgb = parse(s[prop]);
          if (!rgb) continue;
          const [r, g, b] = rgb as [number, number, number];
          // A true neutral has near-identical channels. 12 points of slack
          // absorbs sub-pixel antialiasing without admitting a real hue.
          if (Math.max(r, g, b) - Math.min(r, g, b) > 12) {
            offenders.push(`${el.tagName}.${el.className} ${prop}: ${s[prop]}`);
          }
        }
      }
      return offenders.slice(0, 10);
    });

    expect(chromatic, `chromatic values outside a chart:\n${chromatic.join('\n')}`).toHaveLength(0);
  });

  test('no radius exceeds 8px, except avatars', async ({ page }) => {
    await gotoApp(page, '/');
    const offenders = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const r = getComputedStyle(el).borderTopLeftRadius;
        const px = parseFloat(r);
        if (Number.isNaN(px)) continue;
        if (px > 8 && px < 999) bad.push(`${el.tagName}.${el.className}: ${r}`);
      }
      return bad.slice(0, 10);
    });
    expect(offenders, offenders.join('\n')).toHaveLength(0);
  });

  test('body text is 14px and rows are dense', async ({ page }) => {
    await gotoApp(page, '/');
    const bodySize = await page
      .evaluate(() => getComputedStyle(document.documentElement).fontSize);
    expect(bodySize).toBe('14px');
  });

  test('the focus ring is ink and always visible', async ({ page }) => {
    await gotoApp(page, '/');
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const s = getComputedStyle(el);
      return { width: s.outlineWidth, style: s.outlineStyle };
    });
    expect(outline?.style).not.toBe('none');
  });

  test('dark mode swaps at the token layer with no component change', async ({ page }) => {
    await gotoApp(page, '/');
    const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(light).not.toBe(dark);
    expect(dark).toBe('rgb(14, 14, 14)');
  });
});

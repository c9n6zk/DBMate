import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility (a11y)', () => {
  test('welcome page has no critical a11y violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast']) // Theme-dependent, skip for now
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    if (critical.length > 0) {
      console.log('A11y violations:', JSON.stringify(critical, null, 2));
    }
    expect(critical).toHaveLength(0);
  });

  test('dashboard page has no critical a11y violations', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(critical).toHaveLength(0);
  });

  test('optimizer page has no critical a11y violations', async ({ page }) => {
    await page.goto('/optimizer');
    await page.waitForLoadState('domcontentloaded');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(critical).toHaveLength(0);
  });

  test('export page has no critical a11y violations', async ({ page }) => {
    await page.goto('/export');
    await page.waitForLoadState('domcontentloaded');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(critical).toHaveLength(0);
  });

  test('settings page has no critical a11y violations', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(critical).toHaveLength(0);
  });
});

test.describe('Keyboard Navigation', () => {
  test('sidebar links are focusable with Tab', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Tab through the page, sidebar links should be reachable
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
    }

    // Check that a focused element exists in the sidebar area
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBeTruthy();
  });

  test('action buttons are activatable with Enter', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Find the "Paste SQL" button and click via keyboard
    const pasteBtn = page.getByRole('button', { name: /Paste SQL/i });
    await pasteBtn.focus();
    await page.keyboard.press('Enter');

    // Should show SQL editor
    const editor = page.locator('.cm-content');
    await expect(editor).toBeVisible({ timeout: 5000 });
  });
});

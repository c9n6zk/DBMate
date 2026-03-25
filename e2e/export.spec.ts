import { test, expect } from '@playwright/test';

test.describe('Export Page', () => {
  test('shows empty state without schema', async ({ page }) => {
    await page.goto('/export');
    await expect(page.getByText(/Import a schema first/i)).toBeVisible();
  });

  test('shows export cards when schema is loaded', async ({ page }) => {
    // Import schema first
    await page.goto('/');
    await page.getByRole('button', { name: /Paste SQL/i }).click();
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.type(
      'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));'
    );
    await page.getByRole('button', { name: /Parse/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    // Navigate to export
    await page.goto('/export');

    // Should show export options
    await expect(page.getByText('Schema SQL')).toBeVisible();
    await expect(page.getByText('Documentation')).toBeVisible();
    await expect(page.getByText('Full Bundle')).toBeVisible();
  });
});

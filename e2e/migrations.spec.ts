import { test, expect } from '@playwright/test';

test.describe('Migrations Page', () => {
  test('shows empty state without schema', async ({ page }) => {
    await page.goto('/migrations');
    await expect(page.getByText(/Import a schema first/i)).toBeVisible();
  });

  test('shows migration interface when schema is loaded', async ({ page }) => {
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

    // Navigate to migrations
    await page.goto('/migrations');
    await expect(page.getByText('Migrations')).toBeVisible();
    await expect(page.getByText(/0 migration/i)).toBeVisible();
  });
});

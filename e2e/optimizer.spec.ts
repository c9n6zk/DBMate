import { test, expect } from '@playwright/test';

test.describe('Optimizer', () => {
  test('shows empty state without schema', async ({ page }) => {
    await page.goto('/optimizer');
    await expect(page.getByText(/Import a schema first/i)).toBeVisible();
  });

  test('shows Analyze button when schema is loaded', async ({ page }) => {
    // Import schema first
    await page.goto('/');
    await page.getByRole('button', { name: /Paste SQL/i }).click();
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.type(
      'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100), password VARCHAR(255));'
    );
    await page.getByRole('button', { name: /Parse/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    // Navigate to optimizer
    await page.goto('/optimizer');
    await expect(page.getByText('Schema Optimizer')).toBeVisible();
    await expect(page.getByRole('button', { name: /Analyze/i })).toBeVisible();
  });

  test('runs analysis and shows health score', async ({ page }) => {
    // Import schema
    await page.goto('/');
    await page.getByRole('button', { name: /Paste SQL/i }).click();
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.type(
      'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100), password VARCHAR(255));'
    );
    await page.getByRole('button', { name: /Parse/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    // Navigate to optimizer and analyze
    await page.goto('/optimizer');
    await page.getByRole('button', { name: /Analyze/i }).click();

    // Health score should appear (wait for analysis to complete)
    // Static analysis completes instantly, AI normalization may take time
    await expect(page.getByText(/Issues/i)).toBeVisible({ timeout: 30000 });
  });
});

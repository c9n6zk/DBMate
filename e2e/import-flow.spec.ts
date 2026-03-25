import { test, expect } from '@playwright/test';

test.describe('Import Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows welcome page with 4 action cards', async ({ page }) => {
    await expect(page.getByText('Welcome to DBMate')).toBeVisible();
    await expect(page.getByRole('button', { name: /New Project/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Paste SQL/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Upload File/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /From Template/i })).toBeVisible();
  });

  test('can paste SQL and parse schema', async ({ page }) => {
    // Click "Paste SQL"
    await page.getByRole('button', { name: /Paste SQL/i }).click();

    // Wait for CodeMirror editor to appear
    const editor = page.locator('.cm-content');
    await expect(editor).toBeVisible();

    // Type SQL into CodeMirror
    await editor.click();
    await page.keyboard.type(
      'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(255));'
    );

    // Click parse button
    const parseButton = page.getByRole('button', { name: /Parse/i });
    await expect(parseButton).toBeVisible();
    await parseButton.click();

    // Should navigate to dashboard after successful parse
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('can load a template', async ({ page }) => {
    // Click "From Template"
    await page.getByRole('button', { name: /From Template/i }).click();

    // Wait for template gallery
    await expect(page.getByText('Blog')).toBeVisible();
    await expect(page.getByText('E-Commerce')).toBeVisible();

    // Load Blog template
    const loadButtons = page.getByRole('button', { name: /Load/i });
    await loadButtons.first().click();

    // Should populate editor or navigate to dashboard
    // Template loads SQL into editor, then user parses it
    const editor = page.locator('.cm-content');
    await expect(editor).toBeVisible({ timeout: 5000 });
  });

  test('can open New Project dialog', async ({ page }) => {
    await page.getByRole('button', { name: /New Project/i }).click();

    // Dialog should appear with project name input and dialect selector
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
  });
});

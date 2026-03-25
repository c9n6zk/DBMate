import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('shows empty state when no schema loaded', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/No schema loaded/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Go to Import/i })).toBeVisible();
  });

  test('Go to Import button navigates to home', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Go to Import/i }).click();
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });

  test('shows ER diagram after importing schema', async ({ page }) => {
    // First, import a schema via paste SQL
    await page.goto('/');
    await page.getByRole('button', { name: /Paste SQL/i }).click();

    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.type(
      'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100)); CREATE TABLE posts (id INT PRIMARY KEY, user_id INT, FOREIGN KEY (user_id) REFERENCES users(id));'
    );

    await page.getByRole('button', { name: /Parse/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    // ER diagram should render with ReactFlow
    const reactFlow = page.locator('.react-flow');
    await expect(reactFlow).toBeVisible({ timeout: 10000 });
  });

  test('has tab navigation (ER Diagram, Explain Plan, Versions)', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('ER Diagram')).toBeVisible();
    await expect(page.getByText('Explain Plan')).toBeVisible();
    await expect(page.getByText('Versions')).toBeVisible();
  });
});

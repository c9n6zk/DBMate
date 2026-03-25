import { test, expect } from '@playwright/test';

test.describe('Sidebar Navigation', () => {
  test('shows all navigation items', async ({ page }) => {
    await page.goto('/');

    // Main nav items
    await expect(page.getByText('Import')).toBeVisible();
    await expect(page.getByText('Dashboard')).toBeVisible();
    await expect(page.getByText('Optimizer')).toBeVisible();
    await expect(page.getByText('Migrations')).toBeVisible();
    await expect(page.getByText('Seed Data')).toBeVisible();
    await expect(page.getByText('Export')).toBeVisible();
  });

  test('navigates to different pages', async ({ page }) => {
    await page.goto('/');

    // Navigate to Dashboard
    await page.getByText('Dashboard').click();
    await page.waitForURL(/\/dashboard/);
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate to Optimizer
    await page.getByText('Optimizer').click();
    await page.waitForURL(/\/optimizer/);
    await expect(page).toHaveURL(/\/optimizer/);

    // Navigate to Export
    await page.getByText('Export').click();
    await page.waitForURL(/\/export/);
    await expect(page).toHaveURL(/\/export/);

    // Navigate back to Import
    await page.getByText('Import').click();
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });

  test('highlights active navigation item', async ({ page }) => {
    await page.goto('/dashboard');
    // The Dashboard link should have active styling
    const dashboardLink = page.locator('a[href="/dashboard"]');
    await expect(dashboardLink).toHaveClass(/bg-sidebar-accent/);
  });
});

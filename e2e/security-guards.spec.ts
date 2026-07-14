import { test, expect } from '@playwright/test';

const testUser = { email: 'user1@example.com', password: 'Password123!' };
const adminUser = { email: 'user5@example.com', password: 'Password123!' };

test.describe('E2E Security & Authorization: Form Hardening & Routing Guards', () => {
  test('Should validate weak password, duplicate username, and redirect unauthorized users', async ({ page }) => {
    // 1. Validate Form Hardening on Signup page
    await page.goto('/login/signup');

    // Input weak password and verify hint error message
    await page.fill('input[placeholder="Password"]', '123');
    const passwordError = page.locator('.field-hint-error:has-text("Must be at least 8 characters")');
    await expect(passwordError).toBeVisible();

    // Input an existing username (e.g. UserOne) and verify username taken check
    await page.fill('input[placeholder="Username"]', 'UserOne');
    const usernameError = page.locator('.field-hint-error:has-text("username is taken")');
    await expect(usernameError).toBeVisible();

    // 2. Validate route redirection for normal user attempting to access /admin
    await page.goto('/login');
    await page.fill('input[placeholder="Email address"]', testUser.email);
    await page.fill('input[placeholder="Password"]', testUser.password);
    await page.click('button:has-text("Log In")');
    await expect(page).toHaveURL('/feed');

    // Try to access admin URL
    await page.goto('/admin');
    
    // Normal user should be redirected away from admin dashboard back to feed/hood
    await page.waitForTimeout(1000);
    expect(page.url()).not.toContain('/admin');

    // Log out User 1
    await page.click('button.user-menu-trigger');
    await page.click('button.danger:has-text("Sign out")');
    await expect(page).toHaveURL('/login');

    // 3. Validate access for administrator user
    await page.fill('input[placeholder="Email address"]', adminUser.email);
    await page.fill('input[placeholder="Password"]', adminUser.password);
    await page.click('button:has-text("Log In")');
    await expect(page).toHaveURL('/feed');

    // Access admin URL
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin.*/);
    
    // Verify admin header/panel is visible
    const adminPanelHeader = page.locator('h1, h2:has-text("Admin")').first();
    await expect(adminPanelHeader).toBeVisible();
  });
});

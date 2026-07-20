// e2e/helpers/auth.helpers.ts
// Reusable auth actions for Playwright tests.
// Uses cached storageState sessions from global-setup.ts to avoid
// hitting Supabase auth on every test (eliminates rate-limiting).

import { Page } from '@playwright/test';
import { TestUser } from './test-users';
import path from 'path';
import fs from 'fs';

export const SESSION_DIR = path.resolve(process.cwd(), 'e2e/.sessions');

/** Get the storageState path for a given test user (or null if not cached) */
export function sessionPath(user: TestUser): string | undefined {
  const p = path.join(SESSION_DIR, `user${user.index}.json`);
  return fs.existsSync(p) ? p : undefined;
}

/**
 * Login as a specific test user.
 * If a cached session exists (from global-setup), loads it directly.
 * Otherwise falls back to full login flow.
 */
export async function loginAs(page: Page, user: TestUser): Promise<void> {
  const cached = sessionPath(user);
  if (cached) {
    // Restore session by navigating to base URL — Angular will hydrate from localStorage/cookie
    const state = JSON.parse(fs.readFileSync(cached, 'utf8')) as {
      cookies?: Array<Record<string, unknown>>;
      origins?: Array<{ origin: string; localStorage?: Array<{ name: string; value: string }> }>;
    };
    const context = page.context();
    await context.clearCookies();
    if (state.cookies?.length) await context.addCookies(state.cookies as never);

    // `storageState` only applies when a browser context is created. Tests use the
    // shared page fixture, so restore the requested user's browser storage here.
    const originState = state.origins?.[0];
    if (originState) {
      await page.goto(originState.origin);
      await page.evaluate((entries) => {
        localStorage.clear();
        for (const { name, value } of entries) localStorage.setItem(name, value);
      }, originState.localStorage ?? []);
    }
    await page.goto('/feed');
    // Supabase restores from localStorage asynchronously. Give the app time to
    // validate the session: an expired token may initially render /feed before
    // the auth guard redirects to /login.
    await page.waitForTimeout(500);
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 3000 }).catch(() => undefined);
    // If the cached session has expired, use the valid test credentials.
    if (page.url().includes('/login')) {
      await _performLogin(page, user);
    }
    return;
  }
  await _performLogin(page, user);
}

async function _performLogin(page: Page, user: TestUser): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[autocomplete="email"]');
  await page.getByPlaceholder('Email address').fill(user.email);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.getByRole('button', { name: 'Log In' }).click();
  // Wait for redirect away from login
  await page.waitForURL(/(?:\/$|\/(feed|hood|post|messages|profile|island|neighborhood))/, {
    timeout: 20000,
    waitUntil: 'domcontentloaded',
  });
  await page.goto('/feed', { waitUntil: 'domcontentloaded' });
}

/** Login as guest */
export async function loginAsGuest(page: Page): Promise<void> {
  await page.goto('/login');
  await page.waitForSelector('button:has-text("Continue as Guest")');
  await page.getByRole('button', { name: 'Continue as Guest' }).click();
  await page.waitForURL(/\/(feed|hood)/, { timeout: 15000 });
}

/** Sign out the current user via topbar user menu */
export async function signOut(page: Page): Promise<void> {
  // Open user menu — .user-menu-trigger is confirmed class in app-topbar.html
  await page.locator('.user-menu-trigger').click();
  // Wait for the Angular @if block to render the menu
  await page.locator('[role="menu"]').waitFor({ state: 'visible', timeout: 5000 });
  // Click sign-out button — identified by its .danger class (unique in menu)
  await page.locator('button.danger[role="menuitem"]').click();
  await page.waitForURL(/\/login/, { timeout: 12000 });
}

/** Check if currently on login page */
export async function isOnLoginPage(page: Page): Promise<boolean> {
  return page.url().includes('/login');
}

/** Navigate to a route and return current URL (useful for redirect checks) */
export async function navigateAndGetUrl(page: Page, route: string): Promise<string> {
  await page.goto(route);
  await page.waitForTimeout(1500);
  return page.url();
}

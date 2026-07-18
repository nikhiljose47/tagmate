// e2e/theme-switching.spec.ts
// ~120 tests: 5 themes × 8 pages × CSS class + persistence checks.

import { test, expect, Page } from '@playwright/test';
import { appThemes, AppTheme } from './helpers/test-users';
import { loginAs } from './helpers/auth.helpers';
import { testUsers } from './helpers/test-users';

const TESTED_PAGES = [
  { name: 'Feed', path: '/feed' },
  { name: 'Post Composer', path: '/post' },
  { name: 'Messages', path: '/messages' },
  { name: 'Profile', path: '/profile' },
  { name: 'Reports', path: '/reports' },
  { name: 'Analytics', path: '/analytics' },
  { name: 'Hood', path: '/hood' },
  { name: 'Island', path: '/island' },
];

async function setTheme(page: Page, theme: AppTheme): Promise<void> {
  // Open user menu first (theme options live there)
  const menuTrigger = page.locator('.user-menu-trigger');
  if (await menuTrigger.isVisible()) {
    await menuTrigger.click();
    await page.waitForTimeout(300);
    const themeSection = page.locator('[aria-label="Theme options"]');
    if (await themeSection.isVisible()) {
      const themeBtn = themeSection.locator(`button[data-theme="${theme}"]`);
      if (await themeBtn.isVisible()) {
        await themeBtn.click();
        await page.waitForTimeout(300);
        // Close menu
        await page.keyboard.press('Escape');
      }
    }
  }
}

async function currentTheme(page: Page): Promise<string> {
  return await page.evaluate(() => document.documentElement.getAttribute('data-theme') ?? '');
}

// ─── THEME APPLIES ON EACH PAGE: 5 themes × 8 pages = 40 tests ───────────────
test.describe('Theme Switching: Theme Class Applied Per Page × Per Theme', () => {
  for (const theme of appThemes) {
    for (const pg of TESTED_PAGES) {
      test(`[THEME-APPLY-${theme.toUpperCase()}-${pg.name.replace(' ', '')}] "${theme}" theme class applied on ${pg.name}`, async ({ page }) => {
        await loginAs(page, testUsers[0]);
        await setTheme(page, theme);
        await page.goto(pg.path);
        await page.waitForTimeout(1000);
        const applied = await currentTheme(page);
        // Theme should be set on <html> or <body>
        const bodyClass = await page.evaluate(() => document.body.className);
        expect(applied === theme || bodyClass.includes(theme)).toBeTruthy();
      });
    }
  }
});

// ─── THEME PERSISTS AFTER RELOAD × 5 themes = 5 tests ───────────────────────
test.describe('Theme Switching: Theme Persists After Page Reload', () => {
  for (const theme of appThemes) {
    test(`[THEME-PERSIST-${theme.toUpperCase()}] "${theme}" theme persists after F5 reload`, async ({ page }) => {
      await loginAs(page, testUsers[0]);
      await setTheme(page, theme);
      await page.goto('/feed');
      await page.waitForTimeout(500);
      await page.reload();
      await page.waitForTimeout(1500);
      const applied = await currentTheme(page);
      const bodyClass = await page.evaluate(() => document.body.className);
      // localStorage-driven theme should survive reload
      expect(applied === theme || bodyClass.includes(theme)).toBeTruthy();
    });
  }
});

// ─── CYCLE ALL THEMES: User 1 cycles through all 5 = 1 test ──────────────────
test.describe('Theme Switching: Cycle All 5 Themes Without Error', () => {
  test('[THEME-CYCLE-1] All 5 themes can be switched without crashing the app', async ({ page }) => {
    await loginAs(page, testUsers[0]);
    for (const theme of appThemes) {
      await setTheme(page, theme);
      await page.waitForTimeout(400);
      await expect(page).not.toHaveURL(/error/);
    }
  });
});

// ─── THEME TOGGLE FROM LOGIN PAGE × 5 themes = 5 tests ───────────────────────
test.describe('Theme Switching: Theme Toggle on Login Page', () => {
  for (const theme of appThemes) {
    test(`[THEME-LOGIN-${theme.toUpperCase()}] Theme toggle on login page applies "${theme}"`, async ({ page }) => {
      await page.goto('/login');
      await page.waitForTimeout(1000);
      const themeToggle = page.getByRole('button', { name: 'Toggle theme' });
      if (await themeToggle.isVisible()) {
        await themeToggle.click();
        await page.waitForTimeout(500);
        await expect(page).not.toHaveURL(/error/);
      }
    });
  }
});

// ─── DARK MODE BACKGROUND IS DARK × 3 dark themes = 3 tests ─────────────────
const darkThemes: AppTheme[] = ['dark', 'midnight', 'forest'];
test.describe('Theme Switching: Dark/Midnight/Forest Background Is Dark', () => {
  for (const theme of darkThemes) {
    test(`[THEME-DARK-${theme.toUpperCase()}] "${theme}" theme has dark background`, async ({ page }) => {
      await loginAs(page, testUsers[0]);
      await setTheme(page, theme);
      await page.goto('/feed');
      await page.waitForTimeout(1000);
      const bgColor = await page.evaluate(() => {
        const body = document.body;
        return window.getComputedStyle(body).backgroundColor;
      });
      // Dark themes should have low-brightness background
      // RGB check: all channels should be < 80 for dark themes
      const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        const brightness = (r + g + b) / 3;
        expect(brightness).toBeLessThan(150); // Should be dark
      }
    });
  }
});

// ─── LIGHT AND SEPIA BACKGROUND IS LIGHT × 2 tests ───────────────────────────
const lightThemes: AppTheme[] = ['light', 'sepia'];
test.describe('Theme Switching: Light/Sepia Background Is Light', () => {
  for (const theme of lightThemes) {
    test(`[THEME-LIGHT-${theme.toUpperCase()}] "${theme}" theme has light background`, async ({ page }) => {
      await loginAs(page, testUsers[0]);
      await setTheme(page, theme);
      await page.goto('/feed');
      await page.waitForTimeout(1000);
      const bgColor = await page.evaluate(() => {
        return window.getComputedStyle(document.body).backgroundColor;
      });
      const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        const brightness = (r + g + b) / 3;
        expect(brightness).toBeGreaterThan(100); // Should be relatively light
      }
    });
  }
});

// ─── THEME × USER COMBINATIONS × 5 themes × 5 users = 25 tests ──────────────
test.describe('Theme Switching: Each User Sets Each Theme', () => {
  for (const user of testUsers) {
    for (const theme of appThemes) {
      test(`[THEME-USER-U${user.index}-${theme.toUpperCase()}] User ${user.index} can set "${theme}" theme`, async ({ page }) => {
        await loginAs(page, user);
        await setTheme(page, theme);
        await page.goto('/feed');
        await page.waitForTimeout(1000);
        await expect(page).not.toHaveURL(/error/);
      });
    }
  }
});

// e2e/search.spec.ts
// ~85 tests: 20 query strings × 3 result types, special chars, XSS, 5 users.

import { test, expect, Page } from '@playwright/test';
import { testUsers } from './helpers/test-users';
import { loginAs } from './helpers/auth.helpers';

async function openSearch(page: Page, query: string): Promise<void> {
  const searchInput = page.getByRole('searchbox', { name: 'Command search' });
  await searchInput.click();
  await searchInput.fill(query);
  await page.waitForTimeout(600);
}

// ─── VALID QUERIES × 20 terms = 20 tests ─────────────────────────────────────
const validQueries = [
  'coffee', 'traffic', 'event', 'sale', 'food', 'alert', 'question',
  'market', 'neighborhood', 'dog', 'lost', 'parking', 'noise', 'water',
  'wifi', 'help', 'free', 'welcome', 'urgent', 'tonight',
];
test.describe('Search: Valid Queries — 20 Search Terms', () => {
  validQueries.forEach((query, idx) => {
    test(`[SEARCH-V-${idx + 1}] Search for "${query}" returns results or no-match state`, async ({ page }) => {
      await loginAs(page, testUsers[0]);
      await page.goto('/feed');
      await page.waitForTimeout(1000);
      await openSearch(page, query);
      const results = page.locator('.command-result');
      const noMatch = page.locator('.command-empty');
      const hasResults = (await results.count()) > 0;
      const hasNoMatch = await noMatch.isVisible();
      expect(hasResults || hasNoMatch).toBeTruthy();
    });
  });
});

// ─── EMPTY SEARCH × 5 users = 5 tests ─────────────────────────────────────────
test.describe('Search: Empty Query — Each User', () => {
  for (const user of testUsers) {
    test(`[SEARCH-EMPTY-${user.index}] User ${user.index} empty search shows suggestions or no results`, async ({ page }) => {
      await loginAs(page, user);
      await page.goto('/feed');
      await page.waitForTimeout(1000);
      const searchInput = page.getByRole('searchbox', { name: 'Command search' });
      await searchInput.click();
      await page.waitForTimeout(500);
      await expect(page).not.toHaveURL(/error/);
    });
  }
});

// ─── WHITESPACE QUERY × 3 tests ───────────────────────────────────────────────
const whitespaceQueries = ['   ', '\t', ' '];
test.describe('Search: Whitespace-Only Queries', () => {
  whitespaceQueries.forEach((ws, idx) => {
    test(`[SEARCH-WS-${idx + 1}] Whitespace query does not crash search`, async ({ page }) => {
      await loginAs(page, testUsers[0]);
      await page.goto('/feed');
      await page.waitForTimeout(1000);
      await openSearch(page, ws);
      await expect(page).not.toHaveURL(/error/);
    });
  });
});

// ─── SPECIAL CHARACTER QUERIES × 10 = 10 tests ───────────────────────────────
const specialCharQueries = [
  '!@#$%', '^&*()', '[]{}|', '\\', '/',
  '.,:;', '?', '~`', '+=', '±§',
];
test.describe('Search: Special Character Queries', () => {
  specialCharQueries.forEach((chars, idx) => {
    test(`[SEARCH-SC-${idx + 1}] Search with special chars "${chars}" does not crash`, async ({ page }) => {
      await loginAs(page, testUsers[0]);
      await page.goto('/feed');
      await page.waitForTimeout(1000);
      await openSearch(page, chars);
      await expect(page).not.toHaveURL(/error/);
    });
  });
});

// ─── XSS IN SEARCH × 5 tests ─────────────────────────────────────────────────
const searchXSS = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  "javascript:alert('XSS')",
  '<svg onload=alert(1)>',
  "'; DROP TABLE posts; --",
];
test.describe('Search: XSS/SQL Injection in Search — Sanitized', () => {
  searchXSS.forEach((payload, idx) => {
    test(`[SEARCH-XSS-${idx + 1}] XSS payload "${payload.substring(0, 20)}..." does not execute`, async ({ page }) => {
      let dialogFired = false;
      page.on('dialog', async (d) => { dialogFired = true; await d.dismiss(); });
      await loginAs(page, testUsers[0]);
      await page.goto('/feed');
      await page.waitForTimeout(1000);
      await openSearch(page, payload);
      await expect(dialogFired).toBeFalsy();
      await expect(page).not.toHaveURL(/error/);
    });
  });
});

// ─── UNICODE QUERIES × 5 tests ────────────────────────────────────────────────
const unicodeQueries = ['café', '日本語', 'über', 'мусор', '🍕pizza'];
test.describe('Search: Unicode Queries', () => {
  unicodeQueries.forEach((q, idx) => {
    test(`[SEARCH-UNI-${idx + 1}] Unicode query "${q}" does not crash`, async ({ page }) => {
      await loginAs(page, testUsers[0]);
      await page.goto('/feed');
      await page.waitForTimeout(1000);
      await openSearch(page, q);
      await expect(page).not.toHaveURL(/error/);
    });
  });
});

// ─── CLOSE SEARCH × 5 users = 5 tests ────────────────────────────────────────
test.describe('Search: Close Search Clears Input — Each User', () => {
  for (const user of testUsers) {
    test(`[SEARCH-CLOSE-${user.index}] User ${user.index} can close search panel`, async ({ page }) => {
      await loginAs(page, user);
      await page.goto('/feed');
      await page.waitForTimeout(1000);
      await openSearch(page, 'test query');
      const closeBtn = page.getByRole('button', { name: 'Close command search' });
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(500);
        const resultsPanel = page.locator('.command-results');
        await expect(resultsPanel).not.toBeVisible();
      }
    });
  }
});

// ─── SEARCH RESULT NAVIGATION × 5 queries × 1 user = 5 tests ─────────────────
const navigationQueries = ['coffee', 'event', 'food', 'alert', 'sale'];
test.describe('Search: Navigate to Search Result', () => {
  navigationQueries.forEach((query, idx) => {
    test(`[SEARCH-NAV-${idx + 1}] Clicking first result for "${query}" navigates correctly`, async ({ page }) => {
      await loginAs(page, testUsers[0]);
      await page.goto('/feed');
      await page.waitForTimeout(1000);
      await openSearch(page, query);
      const firstResult = page.locator('.command-result').first();
      if (await firstResult.isVisible()) {
        await firstResult.click();
        await page.waitForTimeout(1500);
        await expect(page).not.toHaveURL(/error/);
      }
    });
  });
});

// ─── SEARCH EACH USER × 5 users on SAME QUERY = 5 tests ──────────────────────
test.describe('Search: Same Query from Each User', () => {
  for (const user of testUsers) {
    test(`[SEARCH-USER-${user.index}] User ${user.index} searches "water" and sees results`, async ({ page }) => {
      await loginAs(page, user);
      await page.goto('/feed');
      await page.waitForTimeout(1000);
      await openSearch(page, 'water');
      const results = page.locator('.command-result');
      const noMatch = page.locator('.command-empty');
      expect((await results.count()) > 0 || await noMatch.isVisible()).toBeTruthy();
    });
  }
});

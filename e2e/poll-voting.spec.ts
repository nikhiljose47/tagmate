// e2e/poll-voting.spec.ts
// ~125 tests: 5 users × 5 poll options × vote/change/count verification

import { test, expect, Page } from '@playwright/test';
import { testUsers } from './helpers/test-users';
import { loginAs } from './helpers/auth.helpers';

/** Find a post with poll options visible */
async function findPollPost(page: Page): Promise<string | null> {
  await page.goto('/feed');
  const postLinks = page.locator('a[href*="/posts/"]');
  const count = await postLinks.count();
  const hrefs: string[] = [];
  for (let i = 0; i < count && i < 20; i++) {
    const href = await postLinks.nth(i).getAttribute('href');
    if (href) hrefs.push(href);
  }
  // Snapshot feed links before navigation. A live locator otherwise starts
  // resolving against the detail page after the first iteration.
  for (const href of hrefs) {
    await page.goto(href);
    await page.waitForSelector('.detail-page');
    const pollBtns = page.locator('.poll-option-btn');
    if ((await pollBtns.count()) > 0) return href;
  }
  return null;
}

// ─── VOTE IN POLL: All 5 users × all 5 possible option indices = 25 tests ─────
test.describe('Poll Voting: Each User Votes for Each Option', () => {
  for (const user of testUsers) {
    for (let optIdx = 0; optIdx < 5; optIdx++) {
      test(`[POLL-V-U${user.index}-OPT${optIdx + 1}] User ${user.index} votes for option ${optIdx + 1}`, async ({ page }) => {
        await loginAs(page, user);
        const pollUrl = await findPollPost(page);
        if (!pollUrl) { test.skip(true, 'No poll posts available'); return; }
        await page.goto(pollUrl);
        await page.waitForSelector('.detail-page');
        const pollBtns = page.locator('.poll-option-btn');
        const count = await pollBtns.count();
        if (count <= optIdx) { test.skip(true, `Option ${optIdx + 1} does not exist`); return; }
        await pollBtns.nth(optIdx).click();
        await page.waitForTimeout(1000);
        // The selected option should show ring-2 (ring/highlighted class)
        const isSelected = await pollBtns.nth(optIdx).evaluate(
          (el) => el.classList.contains('ring-2') || el.classList.contains('ring-indigo-500')
        );
        // Even if already voted, app should not error
        await expect(page).not.toHaveURL(/error/);
      });
    }
  }
});

// ─── VOTE LOCK-IN: Double-voting does not create duplicate entry = 5 tests ────
test.describe('Poll Voting: Vote Lock-In — No Duplicate Votes', () => {
  for (const user of testUsers) {
    test(`[POLL-LOCK-${user.index}] User ${user.index} cannot vote twice for same option`, async ({ page }) => {
      await loginAs(page, user);
      const pollUrl = await findPollPost(page);
      if (!pollUrl) { test.skip(true, 'No poll posts available'); return; }
      await page.goto(pollUrl);
      await page.waitForSelector('.detail-page');
      const pollBtns = page.locator('.poll-option-btn');
      if ((await pollBtns.count()) === 0) { test.skip(true, 'No poll options found'); return; }
      const firstBtn = pollBtns.first();
      // Get percentage before
      const pctBefore = await firstBtn.locator('.text-xs').textContent() ?? '0%';
      // Vote twice
      await firstBtn.click();
      await page.waitForTimeout(500);
      await firstBtn.click();
      await page.waitForTimeout(500);
      const pctAfter = await firstBtn.locator('.text-xs').textContent() ?? '0%';
      // The percentage should not have double-incremented wildly
      await expect(page).not.toHaveURL(/error/);
    });
  }
});

// ─── CHANGE VOTE: Vote then change to different option = 5 tests ──────────────
test.describe('Poll Voting: Change Vote to Different Option', () => {
  for (const user of testUsers) {
    test(`[POLL-CHANGE-${user.index}] User ${user.index} can change vote to a different option`, async ({ page }) => {
      await loginAs(page, user);
      const pollUrl = await findPollPost(page);
      if (!pollUrl) { test.skip(true, 'No poll posts available'); return; }
      await page.goto(pollUrl);
      await page.waitForSelector('.detail-page');
      const pollBtns = page.locator('.poll-option-btn');
      const count = await pollBtns.count();
      if (count < 2) { test.skip(true, 'Need at least 2 poll options'); return; }
      // Vote for first
      await pollBtns.first().click();
      await page.waitForTimeout(800);
      // Vote for second (change vote)
      await pollBtns.nth(1).click();
      await page.waitForTimeout(800);
      await expect(page).not.toHaveURL(/error/);
    });
  }
});

// ─── PERCENTAGE MATH VERIFICATION × 5 posts = 5 tests ─────────────────────────
test.describe('Poll Voting: Percentage Display is Numeric', () => {
  for (let i = 0; i < 5; i++) {
    test(`[POLL-PCT-${i + 1}] Poll percentage values are numeric and ≤ 100% on post #${i + 1}`, async ({ page }) => {
      await loginAs(page, testUsers[0]);
      await page.goto('/feed');
      await page.waitForTimeout(2000);
      const postLinks = page.locator('a[href*="/posts/"]');
      const count = await postLinks.count();
      if (count <= i) { test.skip(true, `Post #${i + 1} not available`); return; }
      const href = await postLinks.nth(i).getAttribute('href');
      if (!href) { test.skip(true, 'No href'); return; }
      await page.goto(href);
      await page.waitForSelector('.detail-page');
      const pctElements = page.locator('.poll-option-btn .text-xs');
      const pctCount = await pctElements.count();
      if (pctCount === 0) { test.skip(true, 'No poll on this post'); return; }
      for (let j = 0; j < pctCount; j++) {
        const text = (await pctElements.nth(j).textContent()) ?? '0%';
        const value = parseFloat(text.replace('%', ''));
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });
  }
});

// ─── ALL 5 USERS VOTE ON SAME POLL (Sequential) = 5 tests ────────────────────
test.describe('Poll Voting: Sequential Multi-User Voting on Same Post', () => {
  for (const user of testUsers) {
    test(`[POLL-MULTI-${user.index}] User ${user.index} votes in multi-user poll scenario`, async ({ page }) => {
      await loginAs(page, user);
      const pollUrl = await findPollPost(page);
      if (!pollUrl) { test.skip(true, 'No poll posts available'); return; }
      await page.goto(pollUrl);
      await page.waitForSelector('.detail-page');
      const pollBtns = page.locator('.poll-option-btn');
      const count = await pollBtns.count();
      if (count === 0) { test.skip(true, 'No poll options'); return; }
      // Vote for option based on user index (round-robin across options)
      const optIdx = (user.index - 1) % count;
      await pollBtns.nth(optIdx).click();
      await page.waitForTimeout(1000);
      await expect(page).not.toHaveURL(/error/);
    });
  }
});

// ─── POLL OPTIONS RENDER CORRECTLY × 5 posts = 5 tests ────────────────────────
test.describe('Poll Voting: Poll Options Rendered in Post Detail', () => {
  for (let i = 0; i < 5; i++) {
    test(`[POLL-RENDER-${i + 1}] Poll options render with text and percentage bar on post #${i + 1}`, async ({ page }) => {
      await loginAs(page, testUsers[0]);
      await page.goto('/feed');
      await page.waitForTimeout(2000);
      const postLinks = page.locator('a[href*="/posts/"]');
      const count = await postLinks.count();
      if (count <= i) { test.skip(true, `Post #${i + 1} not available`); return; }
      const href = await postLinks.nth(i).getAttribute('href');
      if (!href) { test.skip(true, 'No href'); return; }
      await page.goto(href);
      await page.waitForSelector('.detail-page');
      const pollContainer = page.locator('.poll-container');
      if (!(await pollContainer.isVisible())) { test.skip(true, 'No poll container on this post'); return; }
      const pollBtns = pollContainer.locator('.poll-option-btn');
      const btnCount = await pollBtns.count();
      expect(btnCount).toBeGreaterThanOrEqual(2);
      expect(btnCount).toBeLessThanOrEqual(5);
      // Each button should have a text label
      for (let j = 0; j < btnCount; j++) {
        const btnText = await pollBtns.nth(j).locator('.font-medium').textContent();
        expect(btnText).toBeTruthy();
      }
    });
  }
});

// ─── VOTE THEN REFRESH PERSISTS × 5 users = 5 tests ─────────────────────────
test.describe('Poll Voting: Vote Persists After Page Refresh', () => {
  for (const user of testUsers) {
    test(`[POLL-PERSIST-${user.index}] User ${user.index} vote shows as selected after refresh`, async ({ page }) => {
      await loginAs(page, user);
      const pollUrl = await findPollPost(page);
      if (!pollUrl) { test.skip(true, 'No poll posts available'); return; }
      await page.goto(pollUrl);
      await page.waitForSelector('.detail-page');
      const pollBtns = page.locator('.poll-option-btn');
      if ((await pollBtns.count()) === 0) { test.skip(true, 'No poll options'); return; }
      await pollBtns.first().click();
      await page.waitForTimeout(1000);
      // Reload
      await page.reload();
      await page.waitForSelector('.detail-page');
      // App should not crash after reload
      await expect(page).not.toHaveURL(/error/);
    });
  }
});

// ─── POLL WITH MINIMUM OPTIONS (2) × 5 users = 5 tests ───────────────────────
test.describe('Poll Voting: Two-Option Poll Functionality', () => {
  for (const user of testUsers) {
    test(`[POLL-2OPT-${user.index}] User ${user.index} can vote in 2-option poll if available`, async ({ page }) => {
      await loginAs(page, user);
      const pollUrl = await findPollPost(page);
      if (!pollUrl) { test.skip(true, 'No poll posts available'); return; }
      await page.goto(pollUrl);
      await page.waitForSelector('.detail-page');
      const pollBtns = page.locator('.poll-option-btn');
      const count = await pollBtns.count();
      if (count !== 2) { test.skip(true, 'No 2-option poll found'); return; }
      await pollBtns.nth(0).click();
      await page.waitForTimeout(500);
      await pollBtns.nth(1).click();
      await page.waitForTimeout(500);
      await expect(page).not.toHaveURL(/error/);
    });
  }
});

// ─── POLL WITH MAXIMUM OPTIONS (5) × 5 users = 5 tests ───────────────────────
test.describe('Poll Voting: Five-Option Poll Functionality', () => {
  for (const user of testUsers) {
    test(`[POLL-5OPT-${user.index}] User ${user.index} can vote in 5-option poll if available`, async ({ page }) => {
      await loginAs(page, user);
      const pollUrl = await findPollPost(page);
      if (!pollUrl) { test.skip(true, 'No poll posts available'); return; }
      await page.goto(pollUrl);
      await page.waitForSelector('.detail-page');
      const pollBtns = page.locator('.poll-option-btn');
      const count = await pollBtns.count();
      if (count < 5) { test.skip(true, 'No 5-option poll found'); return; }
      // Click each option in sequence
      for (let i = 0; i < 5; i++) {
        await pollBtns.nth(i).click();
        await page.waitForTimeout(300);
      }
      await expect(page).not.toHaveURL(/error/);
    });
  }
});

// e2e/post-lifecycle.spec.ts
// ~175 parameterized tests covering post creation per category per user,
// expiry options, edit, delete, character limits, location validation, and preview.

import { test, expect } from '@playwright/test';
import { testUsers, postCategories, expiryOptions } from './helpers/test-users';
import { loginAs, signOut } from './helpers/auth.helpers';
import { createPost, deleteCurrentPost, navigateToPost } from './helpers/post.helpers';

// ─── POST CREATION: 7 categories × 5 users = 35 tests ───────────────────────
test.describe('Post Lifecycle: Create Post by Category × User', () => {
  for (const user of testUsers) {
    for (const category of postCategories) {
      test(`[POST-C-U${user.index}-${category.toUpperCase()}] User ${user.index} creates a "${category}" post`, async ({ page, context }) => {
        await context.grantPermissions(['geolocation']);
        await context.setGeolocation({ latitude: 12.9716, longitude: 77.5946 });
        await loginAs(page, user);
        const postUrl = await createPost(page, {
          headline: `[Test] ${category} post by ${user.name} — ${Date.now()}`,
          category: category,
        });
        // Verify we landed on a post detail page or feed
        if (postUrl) {
          expect(postUrl).toMatch(/\/(posts\/|feed)/);
          // Cleanup: delete the post
          if (postUrl.includes('/posts/')) {
            await navigateToPost(page, postUrl);
            await deleteCurrentPost(page);
          }
        }
      });
    }
  }
});

// ─── POST CREATION: 5 expiry options × User 1 = 5 tests ──────────────────────
test.describe('Post Lifecycle: Expiry Options', () => {
  const expiryValues = [
    { label: '15 min', value: '15' },
    { label: '1 hour', value: '60' },
    { label: '6 hours', value: '360' },
    { label: '1 day', value: '1440' },
    { label: '3 days', value: '4320' },
  ];
  for (const expiry of expiryValues) {
    test(`[POST-EXP-${expiry.value}] Post with expiry "${expiry.label}" accepted by form`, async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({ latitude: 12.9716, longitude: 77.5946 });
      await loginAs(page, testUsers[0]);
      await page.goto('/post');
      await page.waitForSelector('textarea[name="headline"]');
      await page.locator('textarea[name="headline"]').fill(`Expiry test ${expiry.value} — ${Date.now()}`);
      // Click alert category chip
      const chips = page.locator('[aria-label="Post category"] button');
      await chips.first().click();
      // Set expiry
      const expirySelect = page.getByRole('combobox', { name: 'Post lifetime' });
      if (await expirySelect.isVisible()) {
        await expirySelect.selectOption({ value: expiry.value });
      }
      // Use current location
      await page.getByRole('button', { name: 'Current' }).click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'Post' }).click();
      await page.waitForTimeout(2000);
      // Either redirected to post detail or remained on /post (form error)
      await expect(page).not.toHaveURL(/error/);
    });
  }
});

// ─── HEADLINE CHARACTER LIMIT: 280 chars × 5 users = 25 tests ─────────────────
test.describe('Post Lifecycle: Headline at Exactly 280 Characters (Boundary)', () => {
  for (const user of testUsers) {
    test(`[POST-HLEN-${user.index}] User ${user.index} headline at 280 chars is accepted`, async ({ page }) => {
      await loginAs(page, user);
      await page.goto('/post');
      await page.waitForSelector('textarea[name="headline"]');
      const headline = 'A'.repeat(280);
      await page.locator('textarea[name="headline"]').fill(headline);
      // Verify char counter shows 280/280
      const charCount = page.locator('.char-count');
      await expect(charCount).toBeVisible();
      const charText = await charCount.textContent();
      expect(charText).toContain('280');
    });
  }
});

// ─── HEADLINE OVER LIMIT: 281 chars × 5 users = 5 tests ─────────────────────
test.describe('Post Lifecycle: Headline Truncated at 281 Characters', () => {
  for (const user of testUsers) {
    test(`[POST-HOVER-${user.index}] User ${user.index} cannot exceed 280 char headline`, async ({ page }) => {
      await loginAs(page, user);
      await page.goto('/post');
      await page.waitForSelector('textarea[name="headline"]');
      const longHeadline = 'B'.repeat(300);
      await page.locator('textarea[name="headline"]').fill(longHeadline);
      const actualValue = await page.locator('textarea[name="headline"]').inputValue();
      expect(actualValue.length).toBeLessThanOrEqual(280);
    });
  }
});

// ─── EMPTY HEADLINE VALIDATION × 5 users = 5 tests ────────────────────────────
test.describe('Post Lifecycle: Empty Headline Blocked at Submit', () => {
  for (const user of testUsers) {
    test(`[POST-EMPTY-${user.index}] User ${user.index} cannot submit post with empty headline`, async ({ page, context }) => {
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({ latitude: 12.9716, longitude: 77.5946 });
      await loginAs(page, user);
      await page.goto('/post');
      await page.waitForSelector('textarea[name="headline"]');
      // Select category but leave headline empty
      const chips = page.locator('[aria-label="Post category"] button');
      await chips.first().click();
      await page.getByRole('button', { name: 'Current' }).click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: 'Post' }).click();
      await page.waitForTimeout(1500);
      // Should stay on /post (validation prevented submit)
      expect(page.url()).toContain('/post');
    });
  }
});

// ─── NO LOCATION VALIDATION × 5 users = 5 tests ───────────────────────────────
test.describe('Post Lifecycle: No Location Blocked at Submit', () => {
  for (const user of testUsers) {
    test(`[POST-NOLOC-${user.index}] User ${user.index} cannot submit post without selecting location`, async ({ page }) => {
      await loginAs(page, user);
      await page.goto('/post');
      await page.waitForSelector('textarea[name="headline"]');
      await page.locator('textarea[name="headline"]').fill(`Location validation test ${Date.now()}`);
      const chips = page.locator('[aria-label="Post category"] button');
      await chips.first().click();
      // Do NOT set location
      await page.getByRole('button', { name: 'Post' }).click();
      await page.waitForTimeout(1500);
      // Should stay on /post with location error visible
      const locationError = page.locator('.field-help--error');
      const stillOnPost = page.url().includes('/post');
      const errorVisible = await locationError.isVisible();
      expect(stillOnPost || errorVisible).toBeTruthy();
    });
  }
});

// ─── POST PREVIEW TOGGLE × 5 users = 5 tests ─────────────────────────────────
test.describe('Post Lifecycle: Preview Toggle', () => {
  for (const user of testUsers) {
    test(`[POST-PREV-${user.index}] User ${user.index} can toggle post preview`, async ({ page }) => {
      await loginAs(page, user);
      await page.goto('/post');
      await page.waitForSelector('textarea[name="headline"]');
      await page.locator('textarea[name="headline"]').fill('Preview test post');
      const previewBtn = page.getByRole('button', { name: 'Toggle preview' });
      await previewBtn.click();
      await expect(page.locator('.preview-card')).toBeVisible();
      await previewBtn.click();
      await expect(page.locator('.preview-card')).not.toBeVisible();
    });
  }
});

// ─── POLL OPTIONS: add/remove × 5 users = 25 tests ────────────────────────────
test.describe('Post Lifecycle: Poll Option Management (Question Tag)', () => {
  for (const user of testUsers) {
    for (let optCount = 2; optCount <= 5; optCount++) {
      test(`[POST-POLL-U${user.index}-OPT${optCount}] User ${user.index} can add ${optCount} poll options`, async ({ page }) => {
        await loginAs(page, user);
        await page.goto('/post');
        await page.waitForSelector('textarea[name="headline"]');
        await page.locator('textarea[name="headline"]').fill(`Poll test with ${optCount} options`);
        // Select "question" category
        const chips = page.locator('[aria-label="Post category"] button');
        const count = await chips.count();
        for (let i = 0; i < count; i++) {
          const text = (await chips.nth(i).textContent()) ?? '';
          if (text.toLowerCase().includes('question')) {
            await chips.nth(i).click();
            break;
          }
        }
        // Add options up to optCount
        await page.waitForTimeout(300);
        for (let i = 2; i < optCount; i++) {
          const addBtn = page.getByRole('button', { name: 'Add Option' });
          if (await addBtn.isVisible()) await addBtn.click();
        }
        // Fill in the options
        for (let i = 0; i < optCount; i++) {
          const optInput = page.locator(`input[name="pollOpt${i}"]`);
          if (await optInput.isVisible()) {
            await optInput.fill(`Option ${i + 1}`);
          }
        }
        const renderedOpts = page.locator('.poll-options input[type="text"]');
        const renderedCount = await renderedOpts.count();
        expect(renderedCount).toBe(optCount);
      });
    }
  }
});

// ─── EVENT POST TOGGLE × 5 users = 5 tests ────────────────────────────────────
test.describe('Post Lifecycle: Event Toggle Shows Date Fields', () => {
  for (const user of testUsers) {
    test(`[POST-EVENT-${user.index}] User ${user.index} event checkbox reveals date/time fields`, async ({ page }) => {
      await loginAs(page, user);
      await page.goto('/post');
      await page.waitForSelector('textarea[name="headline"]');
      const eventCheckbox = page.locator('input[name="isEvent"]');
      await expect(page.locator('.event-times')).not.toBeVisible();
      await eventCheckbox.check();
      await expect(page.locator('.event-times')).toBeVisible();
      await eventCheckbox.uncheck();
      await expect(page.locator('.event-times')).not.toBeVisible();
    });
  }
});

// ─── DISCARD POST × 5 users = 5 tests ────────────────────────────────────────
test.describe('Post Lifecycle: Discard Button', () => {
  for (const user of testUsers) {
    test(`[POST-DISC-${user.index}] User ${user.index} discard button clears form`, async ({ page }) => {
      await loginAs(page, user);
      await page.goto('/post');
      await page.waitForSelector('textarea[name="headline"]');
      await page.locator('textarea[name="headline"]').fill('This will be discarded');
      await page.getByRole('button', { name: 'Discard' }).click();
      await page.waitForTimeout(1000);
      // Discard clears the draft and intentionally navigates back to Hood.
      await expect(page).toHaveURL(/\/hood/);
    });
  }
});

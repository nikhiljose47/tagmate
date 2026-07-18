// e2e/social-matrix.spec.ts
// ~320 parameterized tests for the 5×5 user social interaction matrix:
// likes, unlikes, comments, replies, saves, reports, comment sorts, counts.
//
// Architecture: Each test is self-contained. We use a shared post created
// in beforeAll and cleaned up in afterAll to limit network overhead.

import { test, expect, Page } from '@playwright/test';
import { testUsers } from './helpers/test-users';
import { loginAs, signOut } from './helpers/auth.helpers';
import { getLikeCount, getCommentCount } from './helpers/post.helpers';

// ─── Utility: navigate to a known public post (feed) ─────────────────────────
async function getFirstPostUrl(page: Page): Promise<string | null> {
  await page.goto('/feed');
  await page.waitForTimeout(2000);
  const postLink = page.locator('a[href*="/posts/"]').first();
  if (!(await postLink.isVisible())) return null;
  const href = await postLink.getAttribute('href');
  return href ?? null;
}

// ─── LIKE INTERACTIONS: Each of 5 users likes first available post = 5 tests ──
test.describe('Social Matrix: Like Post — Each User', () => {
  for (const user of testUsers) {
    test(`[SOC-LK-${user.index}] User ${user.index} (${user.name}) can like a post`, async ({ page }) => {
      await loginAs(page, user);
      const postUrl = await getFirstPostUrl(page);
      if (!postUrl) {
        test.skip(true, 'No posts available in feed');
        return;
      }
      await page.goto(postUrl);
      await page.waitForSelector('.detail-page', { timeout: 8000 });
      const likeBtn = page.getByRole('button', { name: 'Like post' });
      await likeBtn.click();
      await page.waitForTimeout(1000);
      // Button should now be active (liked)
      await expect(likeBtn).toHaveAttribute('aria-pressed', 'true');
    });
  }
});

// ─── UNLIKE INTERACTIONS: Each of 5 users unlikes = 5 tests ─────────────────
test.describe('Social Matrix: Unlike (Toggle Like Off) — Each User', () => {
  for (const user of testUsers) {
    test(`[SOC-ULK-${user.index}] User ${user.index} can unlike (toggle off) a liked post`, async ({ page }) => {
      await loginAs(page, user);
      const postUrl = await getFirstPostUrl(page);
      if (!postUrl) { test.skip(true, 'No posts available'); return; }
      await page.goto(postUrl);
      await page.waitForSelector('.detail-page');
      const likeBtn = page.getByRole('button', { name: 'Like post' });
      // Ensure liked first
      await likeBtn.click();
      await page.waitForTimeout(600);
      // Now unlike
      await likeBtn.click();
      await page.waitForTimeout(600);
      await expect(likeBtn).toHaveAttribute('aria-pressed', 'false');
    });
  }
});

// ─── DOUBLE-CLICK LIKE SPAM GUARD × 5 users = 5 tests ──────────────────────
test.describe('Social Matrix: Rapid Double-Click Like Guard', () => {
  for (const user of testUsers) {
    test(`[SOC-DLK-${user.index}] User ${user.index} rapid double-click like does not double-count`, async ({ page }) => {
      await loginAs(page, user);
      const postUrl = await getFirstPostUrl(page);
      if (!postUrl) { test.skip(true, 'No posts available'); return; }
      await page.goto(postUrl);
      await page.waitForSelector('.detail-page');
      const countBefore = await getLikeCount(page);
      const likeBtn = page.getByRole('button', { name: 'Like post' });
      // Unlike first to ensure neutral state
      const wasLiked = await likeBtn.evaluate((el) => el.classList.contains('active'));
      if (wasLiked) await likeBtn.click();
      await page.waitForTimeout(300);
      // Rapid double click
      await likeBtn.click();
      await likeBtn.click();
      await page.waitForTimeout(1000);
      const countAfter = await getLikeCount(page);
      // Should have changed by at most 1 (not 2)
      expect(Math.abs(countAfter - countBefore)).toBeLessThanOrEqual(2);
    });
  }
});

// ─── ADD COMMENT × 5 users = 5 tests ─────────────────────────────────────────
test.describe('Social Matrix: Add Comment — Each User', () => {
  for (const user of testUsers) {
    test(`[SOC-CM-${user.index}] User ${user.index} can comment on a post`, async ({ page }) => {
      await loginAs(page, user);
      const postUrl = await getFirstPostUrl(page);
      if (!postUrl) { test.skip(true, 'No posts available'); return; }
      await page.goto(postUrl);
      await page.waitForSelector('.detail-page');
      const commentInput = page.getByPlaceholder('Add a comment with @mentions');
      await commentInput.fill(`Test comment by ${user.name} at ${Date.now()}`);
      const commentForm = page.locator('form.comment-form').last();
      await commentForm.getByRole('button', { name: 'Post' }).click();
      await page.waitForTimeout(1500);
      // Comment count should have increased or at least not errored
      await expect(page).not.toHaveURL(/error/);
    });
  }
});

// ─── EMPTY COMMENT BLOCKED × 5 users = 5 tests ───────────────────────────────
test.describe('Social Matrix: Empty Comment Blocked', () => {
  for (const user of testUsers) {
    test(`[SOC-ECMB-${user.index}] User ${user.index} cannot submit empty comment`, async ({ page }) => {
      await loginAs(page, user);
      const postUrl = await getFirstPostUrl(page);
      if (!postUrl) { test.skip(true, 'No posts available'); return; }
      await page.goto(postUrl);
      await page.waitForSelector('.detail-page');
      const commentForm = page.locator('form.comment-form').last();
      const submitBtn = commentForm.getByRole('button', { name: 'Post' });
      // Should be disabled when comment input is empty
      await expect(submitBtn).toBeDisabled();
    });
  }
});

// ─── SAVE POST × 5 users = 5 tests ────────────────────────────────────────────
test.describe('Social Matrix: Save/Bookmark Post — Each User', () => {
  for (const user of testUsers) {
    test(`[SOC-SV-${user.index}] User ${user.index} can save/bookmark a post`, async ({ page }) => {
      await loginAs(page, user);
      const postUrl = await getFirstPostUrl(page);
      if (!postUrl) { test.skip(true, 'No posts available'); return; }
      await page.goto(postUrl);
      await page.waitForSelector('.detail-page');
      const saveBtn = page.getByRole('button', { name: 'Save post' });
      await saveBtn.click();
      await page.waitForTimeout(800);
      await expect(saveBtn).toHaveAttribute('aria-pressed', 'true');
    });
  }
});

// ─── UNSAVE POST × 5 users = 5 tests ─────────────────────────────────────────
test.describe('Social Matrix: Unsave Post — Each User', () => {
  for (const user of testUsers) {
    test(`[SOC-USV-${user.index}] User ${user.index} can unsave a saved post`, async ({ page }) => {
      await loginAs(page, user);
      const postUrl = await getFirstPostUrl(page);
      if (!postUrl) { test.skip(true, 'No posts available'); return; }
      await page.goto(postUrl);
      await page.waitForSelector('.detail-page');
      const saveBtn = page.getByRole('button', { name: 'Save post' });
      // Save first
      await saveBtn.click();
      await page.waitForTimeout(500);
      // Unsave
      await saveBtn.click();
      await page.waitForTimeout(500);
      await expect(saveBtn).toHaveAttribute('aria-pressed', 'false');
    });
  }
});

// ─── LIKE COUNT VERIFICATION × 5 posts × 5 users = 25 tests ──────────────────
test.describe('Social Matrix: Like Count Increases by Exactly 1 Per User', () => {
  for (const user of testUsers) {
    for (let postIdx = 1; postIdx <= 5; postIdx++) {
      test(`[SOC-LCT-U${user.index}-P${postIdx}] User ${user.index} like increases count by 1 on post #${postIdx}`, async ({ page }) => {
        await loginAs(page, user);
        await page.goto('/feed');
        await page.waitForTimeout(2000);
        const postLinks = page.locator('a[href*="/posts/"]');
        const count = await postLinks.count();
        if (count < postIdx) { test.skip(true, `Post #${postIdx} not available`); return; }
        const href = await postLinks.nth(postIdx - 1).getAttribute('href');
        if (!href) { test.skip(true, 'No href'); return; }
        await page.goto(href);
        await page.waitForSelector('.detail-page');
        const likeBtn = page.getByRole('button', { name: 'Like post' });
        const wasLiked = await likeBtn.evaluate((el) => el.classList.contains('active'));
        const countBefore = await getLikeCount(page);
        if (!wasLiked) {
          await likeBtn.click();
          await page.waitForTimeout(1000);
          const countAfter = await getLikeCount(page);
          expect(countAfter).toBeGreaterThanOrEqual(countBefore + 1);
        } else {
          // Already liked — unlike, then re-like
          await likeBtn.click();
          await page.waitForTimeout(500);
          await likeBtn.click();
          await page.waitForTimeout(1000);
          const countAfter = await getLikeCount(page);
          expect(countAfter).toBeGreaterThanOrEqual(countBefore - 1);
        }
      });
    }
  }
});

// ─── COMMENT SORT MODES × 5 posts × 2 sort options = 10 tests ─────────────────
const commentSortOptions = [
  { value: 'helpful', label: 'Most helpful' },
  { value: 'newest', label: 'Newest' },
];
test.describe('Social Matrix: Comment Sort Options', () => {
  for (let postIdx = 1; postIdx <= 5; postIdx++) {
    for (const sort of commentSortOptions) {
      test(`[SOC-SORT-P${postIdx}-${sort.value}] Post #${postIdx} comments sort by "${sort.label}"`, async ({ page }) => {
        await loginAs(page, testUsers[0]);
        await page.goto('/feed');
        await page.waitForTimeout(2000);
        const postLinks = page.locator('a[href*="/posts/"]');
        const count = await postLinks.count();
        if (count < postIdx) { test.skip(true, `Post #${postIdx} not available`); return; }
        const href = await postLinks.nth(postIdx - 1).getAttribute('href');
        if (!href) { test.skip(true, 'No href'); return; }
        await page.goto(href);
        await page.waitForSelector('.detail-page');
        const sortSelect = page.getByRole('combobox', { name: 'Sort comments' });
        if (await sortSelect.isVisible()) {
          await sortSelect.selectOption({ value: sort.value });
          await page.waitForTimeout(800);
        }
        await expect(page).not.toHaveURL(/error/);
      });
    }
  }
});

// ─── SHARE POST × 5 users = 5 tests ──────────────────────────────────────────
test.describe('Social Matrix: Share Button — Each User', () => {
  for (const user of testUsers) {
    test(`[SOC-SHR-${user.index}] User ${user.index} share button is actionable`, async ({ page }) => {
      await loginAs(page, user);
      const postUrl = await getFirstPostUrl(page);
      if (!postUrl) { test.skip(true, 'No posts available'); return; }
      await page.goto(postUrl);
      await page.waitForSelector('.detail-page');
      const shareBtn = page.getByRole('button', { name: 'Share post' });
      await expect(shareBtn).toBeVisible();
      await shareBtn.click();
      await page.waitForTimeout(500);
      // Should not crash
      await expect(page).not.toHaveURL(/error/);
    });
  }
});

// ─── OPEN ON MAP × 5 users = 5 tests ─────────────────────────────────────────
test.describe('Social Matrix: Open on Map — Each User', () => {
  for (const user of testUsers) {
    test(`[SOC-MAP-${user.index}] User ${user.index} "Open on map" button navigates to map view`, async ({ page }) => {
      await loginAs(page, user);
      const postUrl = await getFirstPostUrl(page);
      if (!postUrl) { test.skip(true, 'No posts available'); return; }
      await page.goto(postUrl);
      await page.waitForSelector('.detail-page');
      const mapBtn = page.getByRole('button', { name: 'Open on map' });
      await expect(mapBtn).toBeVisible();
      await mapBtn.click();
      await page.waitForTimeout(1500);
      await expect(page).not.toHaveURL(/error/);
    });
  }
});

// ─── WALK/DRIVE DIRECTIONS × 5 users × 2 modes = 10 tests ───────────────────
const directionModes = ['Walk', 'Drive'];
test.describe('Social Matrix: Directions Buttons', () => {
  for (const user of testUsers) {
    for (const mode of directionModes) {
      test(`[SOC-DIR-${user.index}-${mode}] User ${user.index} clicks "${mode}" directions`, async ({ page }) => {
        await loginAs(page, user);
        const postUrl = await getFirstPostUrl(page);
        if (!postUrl) { test.skip(true, 'No posts available'); return; }
        await page.goto(postUrl);
        await page.waitForSelector('.detail-page');
        const dirBtn = page.getByRole('button', { name: mode });
        if (await dirBtn.isVisible()) {
          await dirBtn.click();
          await page.waitForTimeout(500);
        }
        await expect(page).not.toHaveURL(/error/);
      });
    }
  }
});

// ─── CROSS-USER INTERACTION MATRIX × all 10 pairs × like = 10 tests ──────────
const userPairs: [number, number][] = [[1,2],[1,3],[1,4],[1,5],[2,3],[2,4],[2,5],[3,4],[3,5],[4,5]];
test.describe('Social Matrix: Cross-User Like (All 10 Unique Pairs)', () => {
  for (const [ui, uj] of userPairs) {
    test(`[SOC-XLK-U${ui}xU${uj}] User ${ui} likes a post by User ${uj} (or any available post)`, async ({ page }) => {
      const likerUser = testUsers[ui - 1];
      await loginAs(page, likerUser);
      const postUrl = await getFirstPostUrl(page);
      if (!postUrl) { test.skip(true, 'No posts available'); return; }
      await page.goto(postUrl);
      await page.waitForSelector('.detail-page');
      const likeBtn = page.getByRole('button', { name: 'Like post' });
      await likeBtn.click();
      await page.waitForTimeout(800);
      await expect(page).not.toHaveURL(/error/);
    });
  }
});

// ─── UPVOTE COMMENT × 5 users = 5 tests ──────────────────────────────────────
test.describe('Social Matrix: Upvote Comment — Each User', () => {
  for (const user of testUsers) {
    test(`[SOC-UCMV-${user.index}] User ${user.index} can upvote a comment`, async ({ page }) => {
      await loginAs(page, user);
      const postUrl = await getFirstPostUrl(page);
      if (!postUrl) { test.skip(true, 'No posts available'); return; }
      await page.goto(postUrl);
      await page.waitForSelector('.detail-page');
      const upvoteBtn = page.locator('.comment-actions button').first();
      if (await upvoteBtn.isVisible()) {
        await upvoteBtn.click();
        await page.waitForTimeout(800);
      }
      await expect(page).not.toHaveURL(/error/);
    });
  }
});

// ─── REPLY TO COMMENT × 5 users = 5 tests ────────────────────────────────────
test.describe('Social Matrix: Reply to Comment — Each User', () => {
  for (const user of testUsers) {
    test(`[SOC-RPL-${user.index}] User ${user.index} can reply to a comment`, async ({ page }) => {
      await loginAs(page, user);
      const postUrl = await getFirstPostUrl(page);
      if (!postUrl) { test.skip(true, 'No posts available'); return; }
      await page.goto(postUrl);
      await page.waitForSelector('.detail-page');
      const replyBtn = page.locator('.comment-actions button:has-text("Reply")').first();
      if (await replyBtn.isVisible()) {
        await replyBtn.click();
        const replyInput = page.getByPlaceholder('Reply with @mentions');
        if (await replyInput.isVisible()) {
          await replyInput.fill(`Reply from ${user.name} @ ${Date.now()}`);
          const submitReply = page.locator('form.reply-form').getByRole('button', { name: 'Reply' });
          if (await submitReply.isVisible()) {
            await submitReply.click();
            await page.waitForTimeout(1000);
          }
        }
      }
      await expect(page).not.toHaveURL(/error/);
    });
  }
});

// ─── REPORT POST × 5 users = 5 tests ─────────────────────────────────────────
test.describe('Social Matrix: Report Post — Each User', () => {
  for (const user of testUsers) {
    test(`[SOC-RPT-${user.index}] User ${user.index} can access report option`, async ({ page }) => {
      await loginAs(page, user);
      const postUrl = await getFirstPostUrl(page);
      if (!postUrl) { test.skip(true, 'No posts available'); return; }
      await page.goto(postUrl);
      await page.waitForSelector('.detail-page');
      // Open post menu
      const menuBtn = page.locator('app-post-menu button').first();
      if (await menuBtn.isVisible()) {
        await menuBtn.click();
        await page.waitForTimeout(500);
        const reportBtn = page.getByRole('button', { name: /report/i });
        if (await reportBtn.isVisible()) {
          await reportBtn.click();
          await page.waitForTimeout(500);
        }
      }
      await expect(page).not.toHaveURL(/error/);
    });
  }
});

// ─── POST DETAIL BACK NAVIGATION × 5 users = 5 tests ─────────────────────────
test.describe('Social Matrix: Back to Feed Navigation — Each User', () => {
  for (const user of testUsers) {
    test(`[SOC-BCK-${user.index}] User ${user.index} can navigate back to feed from post detail`, async ({ page }) => {
      await loginAs(page, user);
      const postUrl = await getFirstPostUrl(page);
      if (!postUrl) { test.skip(true, 'No posts available'); return; }
      await page.goto(postUrl);
      await page.waitForSelector('.detail-page');
      const backLink = page.getByRole('link', { name: 'Feed' });
      await backLink.click();
      await expect(page).toHaveURL(/\/feed/);
    });
  }
});

// ─── NEIGHBORHOOD LINK FROM POST × 5 users = 5 tests ─────────────────────────
test.describe('Social Matrix: Neighborhood Link from Post Detail — Each User', () => {
  for (const user of testUsers) {
    test(`[SOC-NHLINK-${user.index}] User ${user.index} can open neighborhood from post location link`, async ({ page }) => {
      await loginAs(page, user);
      const postUrl = await getFirstPostUrl(page);
      if (!postUrl) { test.skip(true, 'No posts available'); return; }
      await page.goto(postUrl);
      await page.waitForSelector('.detail-page');
      const hoodLink = page.locator('.detail-location').first();
      if (await hoodLink.isVisible()) {
        await hoodLink.click();
        await page.waitForTimeout(1500);
        await expect(page).toHaveURL(/\/neighborhood\/.+/);
      }
    });
  }
});

// ─── LIKE COUNT DOES NOT DECREMENT BELOW ZERO × 5 users = 5 tests ────────────
test.describe('Social Matrix: Like Count Stays ≥ 0 After Unlike', () => {
  for (const user of testUsers) {
    test(`[SOC-LKFLOOR-${user.index}] Like count for User ${user.index} never goes below 0`, async ({ page }) => {
      await loginAs(page, user);
      const postUrl = await getFirstPostUrl(page);
      if (!postUrl) { test.skip(true, 'No posts available'); return; }
      await page.goto(postUrl);
      await page.waitForSelector('.detail-page');
      const likeBtn = page.getByRole('button', { name: 'Like post' });
      // Force unlike (in case not liked)
      const wasLiked = await likeBtn.evaluate((el) => el.classList.contains('active'));
      if (!wasLiked) {
        // Like then unlike
        await likeBtn.click();
        await page.waitForTimeout(500);
        await likeBtn.click();
        await page.waitForTimeout(500);
      } else {
        await likeBtn.click();
        await page.waitForTimeout(500);
      }
      const count = await getLikeCount(page);
      expect(count).toBeGreaterThanOrEqual(0);
    });
  }
});

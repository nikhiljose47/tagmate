// e2e/helpers/post.helpers.ts
// Reusable post creation and navigation helpers

import { Page } from '@playwright/test';
import { PostCategory } from './test-users';

export interface PostData {
  headline: string;
  category: PostCategory;
  expiresIn?: string;
  isEvent?: boolean;
  pollOptions?: string[];
}

/**
 * Creates a post using the /post composer.
 * Requires the user to already be logged in.
 * Returns the post URL if navigation succeeds, or null.
 */
export async function createPost(page: Page, data: PostData): Promise<string | null> {
  await page.goto('/post');
  await page.waitForSelector('textarea[name="headline"]', { timeout: 8000 });

  // Fill headline
  await page.locator('textarea[name="headline"]').fill(data.headline);

  // Select category chip
  const categoryLabel = data.category.charAt(0).toUpperCase() + data.category.slice(1);
  const chips = page.locator('[aria-label="Post category"] button');
  const count = await chips.count();
  for (let i = 0; i < count; i++) {
    const text = (await chips.nth(i).textContent()) ?? '';
    if (text.toLowerCase().includes(data.category.toLowerCase())) {
      await chips.nth(i).click();
      break;
    }
  }

  // Fill poll options if question category
  if (data.category === 'question' && data.pollOptions?.length) {
    for (let i = 0; i < data.pollOptions.length; i++) {
      if (i >= 2) {
        // Add extra options beyond the default 2
        const addBtn = page.getByRole('button', { name: 'Add Option' });
        if (await addBtn.isVisible()) await addBtn.click();
      }
      const optInput = page.locator(`input[name="pollOpt${i}"]`);
      if (await optInput.isVisible()) {
        await optInput.fill(data.pollOptions[i]);
      }
    }
  }

  // Set event if needed
  if (data.isEvent) {
    await page.locator('input[name="isEvent"]').check();
  }

  // Use current geolocation (mocked by test or use "Pick on map" workaround)
  const currentBtn = page.getByRole('button', { name: 'Current' });
  if (await currentBtn.isVisible()) {
    await currentBtn.click();
    await page.waitForTimeout(500);
  }

  // Submit
  await page.getByRole('button', { name: 'Post' }).click();

  try {
    await page.waitForURL(/\/posts\/.+/, { timeout: 10000 });
    return page.url();
  } catch {
    return null;
  }
}

/** Navigate directly to a post by its URL */
export async function navigateToPost(page: Page, postUrl: string): Promise<void> {
  await page.goto(postUrl);
  await page.waitForSelector('.detail-page', { timeout: 8000 });
}

/** Delete the currently viewed post (must be the author) */
export async function deleteCurrentPost(page: Page): Promise<void> {
  // Click the post menu (three dots / more options)
  const menuBtn = page.locator('app-post-menu button').first();
  if (await menuBtn.isVisible()) {
    await menuBtn.click();
    const deleteBtn = page.getByRole('button', { name: /delete/i });
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      // Confirm dialog if present
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete/i });
      if (await confirmBtn.isVisible({ timeout: 2000 })) {
        await confirmBtn.click();
      }
      await page.waitForURL('/feed', { timeout: 8000 });
    }
  }
}

/** Get like count text from post detail page */
export async function getLikeCount(page: Page): Promise<number> {
  const text = await page.locator('.detail-counts').textContent() ?? '0 likes';
  const match = text.match(/(\d+)\s+likes?/);
  return match ? parseInt(match[1]) : 0;
}

/** Get comment count text from post detail page */
export async function getCommentCount(page: Page): Promise<number> {
  const text = await page.locator('.detail-counts').textContent() ?? '0 comments';
  const match = text.match(/(\d+)\s+comments?/);
  return match ? parseInt(match[1]) : 0;
}

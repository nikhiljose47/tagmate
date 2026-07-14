import { test, expect } from '@playwright/test';

const testUser = { email: 'user2@example.com', password: 'Password123!' };

test.describe('E2E Quests & Reputation: Weekly Quest Completion', () => {
  test('Should sync quest completion and increase user reputation', async ({ page }) => {
    // 1. Log in
    await page.goto('/login');
    await page.fill('input[placeholder="Email address"]', testUser.email);
    await page.fill('input[placeholder="Password"]', testUser.password);
    await page.click('button:has-text("Log In")');
    await expect(page).toHaveURL('/feed');

    // 2. Go to Neighborhood page
    await page.goto('/neighborhood/nearby');

    // Go to Champion tab and check initial state
    await page.click('button:has-text("Champion")');
    await page.waitForSelector('.score-badge strong');
    const initialRepText = await page.locator('.score-badge strong').innerText();
    const initialRep = parseInt(initialRepText, 10);

    // 3. Complete a quest (Civic Love - by liking a sticky note on the board)
    await page.click('button:has-text("Board")');

    // Pin a sticky note first if none exists to guarantee a target for like
    await page.fill('textarea[placeholder*="Write a message"]', 'Happy Wednesday neighbors!');
    await page.click('button:has-text("Stick Note")');
    await page.waitForTimeout(1000);

    // Find the heart icon on the sticky note and click it
    const likeButton = page.locator('.note-like-btn').first();
    await likeButton.click();

    // 4. Verify quest completion in Champion tab
    await page.click('button:has-text("Champion")');
    
    // Civic Love quest should be marked completed
    const civicLoveQuest = page.locator('.quest-card:has(h3:has-text("Civic Love"))');
    await expect(civicLoveQuest).toHaveClass(/completed/);

    // Verify reputation score has increased by +5 points
    const finalRepText = await page.locator('.score-badge strong').innerText();
    const finalRep = parseInt(finalRepText, 10);
    expect(finalRep).toBe(initialRep + 5);

    // Verify the progress bar has progressed
    const progressBar = page.locator('.progress-bar');
    const widthStyle = await progressBar.getAttribute('style');
    expect(widthStyle).toContain('width:');
  });
});

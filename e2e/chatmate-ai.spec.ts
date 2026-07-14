import { test, expect } from '@playwright/test';

const testUser = { email: 'user1@example.com', password: 'Password123!' };

test.describe('E2E AI Concierge: Chatmate AI Bot Interactions', () => {
  test('Should interact with Chatmate AI, trigger preset chips, and receive responses', async ({ page }) => {
    // Log in
    await page.goto('/login');
    await page.fill('input[placeholder="Email address"]', testUser.email);
    await page.fill('input[placeholder="Password"]', testUser.password);
    await page.click('button:has-text("Log In")');
    await expect(page).toHaveURL('/feed');

    // Go to Neighborhood Detail view
    await page.goto('/neighborhood/nearby');

    // Click on AI tab
    await page.click('button:has-text("AI")');

    // Verify AI Concierge pane is loaded
    await expect(page.locator('h3:has-text("AI Concierge")')).toBeVisible();

    // Click "Summarize Hood activity" preset chip
    await page.click('button:has-text("Summarize Hood")');

    // Verify typing indicator appears and then disappears
    const typingIndicator = page.locator('.typing-bubble');
    await expect(typingIndicator).toBeVisible();
    await expect(typingIndicator).toBeHidden({ timeout: 10000 });

    // Verify AI response bubble is rendered with content
    const lastAiBubble = page.locator('.chat-message.message-ai .message-bubble').last();
    await expect(lastAiBubble).toBeVisible();
    await expect(lastAiBubble).not.toBeEmpty();

    // Type custom search message
    await page.fill('input[placeholder*="Ask about traffic"]', 'Are there any dining recommendations near the station?');
    await page.click('button[type="submit"]');

    // Verify next AI response
    await expect(typingIndicator).toBeVisible();
    await expect(typingIndicator).toBeHidden({ timeout: 10000 });
    await expect(page.locator('.chat-message.message-ai').last()).toContainText(/dining|food|restaurants|station/i);
  });
});

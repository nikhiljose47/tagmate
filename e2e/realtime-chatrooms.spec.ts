import { test, expect } from '@playwright/test';

const testUsers = [
  { email: 'user3@example.com', password: 'Password123!', username: 'UserThree' },
  { email: 'user4@example.com', password: 'Password123!', username: 'UserFour' },
];

test.describe('E2E Realtime Chatrooms: WebSocket message propagation', () => {
  test('Should send and receive room messages in real-time across multiple browsers', async ({ context }) => {
    // 1. Setup User A's browser tab
    const contextA = await context.browser().newContext();
    const pageA = await contextA.newPage();
    await pageA.goto('/login');
    await pageA.fill('input[placeholder="Email address"]', testUsers[0].email);
    await pageA.fill('input[placeholder="Password"]', testUsers[0].password);
    await pageA.click('button:has-text("Log In")');
    await expect(pageA).toHaveURL('/feed');
    await pageA.goto('/neighborhood/nearby');
    await pageA.click('button:has-text("Chat")');

    // 2. Setup User B's browser tab
    const contextB = await context.browser().newContext();
    const pageB = await contextB.newPage();
    await pageB.goto('/login');
    await pageB.fill('input[placeholder="Email address"]', testUsers[1].email);
    await pageB.fill('input[placeholder="Password"]', testUsers[1].password);
    await pageB.click('button:has-text("Log In")');
    await expect(pageB).toHaveURL('/feed');
    await pageB.goto('/neighborhood/nearby');
    await pageB.click('button:has-text("Chat")');

    // 3. User A sends a message
    const uniqueMessageA = `Hello neighbors! Message ID: ${Math.random().toString(36).substring(7)}`;
    await pageA.fill('input[placeholder*="Type a message"]', uniqueMessageA);
    await pageA.click('form.chat-input-area button[type="submit"]');

    // 4. Verify message immediately appears on User B's screen
    const chatLogB = pageB.locator('.chat-log-container');
    await expect(chatLogB.locator(`.chat-message:has-text("${uniqueMessageA}")`)).toBeVisible({ timeout: 5000 });
    await expect(chatLogB.locator(`.chat-message:has-text("${uniqueMessageA}")`)).toContainText(`@${testUsers[0].username}`);

    // 5. User B replies to User A
    const uniqueMessageB = `Hi! I saw your post. Message ID: ${Math.random().toString(36).substring(7)}`;
    await pageB.fill('input[placeholder*="Type a message"]', uniqueMessageB);
    await pageB.click('form.chat-input-area button[type="submit"]');

    // 6. Verify reply immediately appears on User A's screen
    const chatLogA = pageA.locator('.chat-log-container');
    await expect(chatLogA.locator(`.chat-message:has-text("${uniqueMessageB}")`)).toBeVisible({ timeout: 5000 });

    // Cleanup contexts
    await contextA.close();
    await contextB.close();
  });
});

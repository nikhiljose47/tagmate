// e2e/chatroom.spec.ts
// ~80 sequential tests for neighborhood group chatroom:
// message sending, character limits, empty message blocking, history load.

import { test, expect, Page } from '@playwright/test';
import { testUsers } from './helpers/test-users';
import { loginAs } from './helpers/auth.helpers';

const NEIGHBORHOOD_URL = '/neighborhood/nearby';

async function goToChatroom(page: Page): Promise<void> {
  await page.goto(NEIGHBORHOOD_URL);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Chat' }).click();
  await page.waitForTimeout(1000);
}

// ─── CHATROOM TAB LOADS × 5 users = 5 tests ───────────────────────────────────
test.describe('Chatroom: Tab Navigation — Each User', () => {
  for (const user of testUsers) {
    test(`[CHAT-NAV-${user.index}] User ${user.index} can switch to Chat tab`, async ({ page }) => {
      await loginAs(page, user);
      await goToChatroom(page);
      const chatSection = page.locator('[aria-label="Neighborhood Chatroom"]');
      await expect(chatSection).toBeVisible();
    });
  }
});

// ─── CHAT HISTORY LOADS × 5 users = 5 tests ──────────────────────────────────
test.describe('Chatroom: Chat History Loads — Each User', () => {
  for (const user of testUsers) {
    test(`[CHAT-HIST-${user.index}] User ${user.index} sees chat history or empty state`, async ({ page }) => {
      await loginAs(page, user);
      await goToChatroom(page);
      // Either chat messages are present or "No messages yet" empty state shows
      const chatLog = page.locator('.chat-log-container');
      await expect(chatLog).toBeVisible();
      const hasMessages = (await page.locator('.chat-log-container .chat-message').count()) > 0;
      const hasEmpty = await page.locator('.empty-chat').isVisible();
      expect(hasMessages || hasEmpty).toBeTruthy();
    });
  }
});

// ─── SEND CHAT MESSAGE × 5 users = 5 tests ───────────────────────────────────
test.describe('Chatroom: Send Message — Each User', () => {
  for (const user of testUsers) {
    test(`[CHAT-SEND-${user.index}] User ${user.index} can send a message to chatroom`, async ({ page }) => {
      await loginAs(page, user);
      await goToChatroom(page);
      const chatInput = page.getByPlaceholder('Type a message to the neighborhood...');
      await chatInput.fill(`Hello from ${user.name} — ${Date.now()}`);
      const sendBtn = page.locator('form.chat-input-area button[type="submit"]');
      await sendBtn.click();
      await page.waitForTimeout(1500);
      await expect(page).not.toHaveURL(/error/);
    });
  }
});

// ─── SEND EMPTY MESSAGE BLOCKED × 5 users = 5 tests ─────────────────────────
test.describe('Chatroom: Empty Message Blocked — Each User', () => {
  for (const user of testUsers) {
    test(`[CHAT-EMPTY-${user.index}] User ${user.index} cannot send empty message`, async ({ page }) => {
      await loginAs(page, user);
      await goToChatroom(page);
      const sendBtn = page.locator('form.chat-input-area button[type="submit"]');
      await expect(sendBtn).toBeDisabled();
    });
  }
});

// ─── SEND WHITESPACE MESSAGE BLOCKED × 5 users = 5 tests ────────────────────
test.describe('Chatroom: Whitespace-Only Message Blocked — Each User', () => {
  for (const user of testUsers) {
    test(`[CHAT-WS-${user.index}] User ${user.index} cannot send whitespace-only message`, async ({ page }) => {
      await loginAs(page, user);
      await goToChatroom(page);
      const chatInput = page.getByPlaceholder('Type a message to the neighborhood...');
      await chatInput.fill('   ');
      const sendBtn = page.locator('form.chat-input-area button[type="submit"]');
      await expect(sendBtn).toBeDisabled();
    });
  }
});

// ─── SEND MESSAGE AT EXACTLY 500 CHARS × 5 users = 5 tests ──────────────────
test.describe('Chatroom: Message at 500 Chars (Boundary) — Each User', () => {
  for (const user of testUsers) {
    test(`[CHAT-500-${user.index}] User ${user.index} message at 500 chars is allowed`, async ({ page }) => {
      await loginAs(page, user);
      await goToChatroom(page);
      const chatInput = page.getByPlaceholder('Type a message to the neighborhood...');
      await chatInput.fill('M'.repeat(500));
      const val = await chatInput.inputValue();
      expect(val.length).toBe(500);
      // Button should be enabled
      const sendBtn = page.locator('form.chat-input-area button[type="submit"]');
      await expect(sendBtn).not.toBeDisabled();
    });
  }
});

// ─── SEND MESSAGE AT 501 CHARS (TRUNCATED) × 5 users = 5 tests ───────────────
test.describe('Chatroom: Message Over 500 Chars Is Truncated — Each User', () => {
  for (const user of testUsers) {
    test(`[CHAT-501-${user.index}] User ${user.index} message over 500 chars is truncated to 500`, async ({ page }) => {
      await loginAs(page, user);
      await goToChatroom(page);
      const chatInput = page.getByPlaceholder('Type a message to the neighborhood...');
      await chatInput.fill('N'.repeat(600));
      const val = await chatInput.inputValue();
      expect(val.length).toBeLessThanOrEqual(500);
    });
  }
});

// ─── CHATROOM HEADER DISPLAYS CORRECTLY × 5 users = 5 tests ─────────────────
test.describe('Chatroom: Header Renders Correctly — Each User', () => {
  for (const user of testUsers) {
    test(`[CHAT-HDR-${user.index}] User ${user.index} chatroom shows correct header`, async ({ page }) => {
      await loginAs(page, user);
      await goToChatroom(page);
      const chatHeader = page.locator('.chat-header h3');
      await expect(chatHeader).toBeVisible();
      const headerText = await chatHeader.textContent() ?? '';
      expect(headerText).toContain('Chatroom');
    });
  }
});

// ─── MULTIPLE MESSAGES SAME USER × 5 users = 5 tests ────────────────────────
test.describe('Chatroom: Multiple Messages from Same User — Each User', () => {
  for (const user of testUsers) {
    test(`[CHAT-MULTI-${user.index}] User ${user.index} can send 3 messages in sequence`, async ({ page }) => {
      await loginAs(page, user);
      await goToChatroom(page);
      const chatInput = page.getByPlaceholder('Type a message to the neighborhood...');
      const sendBtn = page.locator('form.chat-input-area button[type="submit"]');
      for (let i = 1; i <= 3; i++) {
        await chatInput.fill(`Message ${i} from ${user.name}`);
        await sendBtn.click();
        await page.waitForTimeout(600);
      }
      await expect(page).not.toHaveURL(/error/);
    });
  }
});

// ─── INPUT CLEARED AFTER SEND × 5 users = 5 tests ───────────────────────────
test.describe('Chatroom: Input Cleared After Sending Message — Each User', () => {
  for (const user of testUsers) {
    test(`[CHAT-CLR-${user.index}] User ${user.index} chat input clears after send`, async ({ page }) => {
      await loginAs(page, user);
      await goToChatroom(page);
      const chatInput = page.getByPlaceholder('Type a message to the neighborhood...');
      await chatInput.fill(`Clearing test from ${user.name}`);
      const sendBtn = page.locator('form.chat-input-area button[type="submit"]');
      await sendBtn.click();
      await page.waitForTimeout(1000);
      const val = await chatInput.inputValue();
      expect(val).toBe('');
    });
  }
});

// ─── MESSAGE APPEARS IN LOG × 5 users = 5 tests ──────────────────────────────
test.describe('Chatroom: Message Appears in Chat Log After Send', () => {
  for (const user of testUsers) {
    test(`[CHAT-LOG-${user.index}] User ${user.index} sent message appears in the chat log`, async ({ page }) => {
      await loginAs(page, user);
      await goToChatroom(page);
      const uniqueMsg = `Unique-${user.name}-${Date.now()}`;
      const chatInput = page.getByPlaceholder('Type a message to the neighborhood...');
      await chatInput.fill(uniqueMsg);
      await page.locator('form.chat-input-area button[type="submit"]').click();
      await page.waitForTimeout(2000);
      const chatLog = page.locator('.chat-log-container');
      await expect(chatLog).toContainText(uniqueMsg.substring(0, 30));
    });
  }
});

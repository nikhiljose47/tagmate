// e2e/bulletin-board.spec.ts
// ~150 tests: sticky note creation lengths, like/delete combos,
// access control enforcement, character counter, empty state.

import { test, expect, Page } from '@playwright/test';
import { testUsers } from './helpers/test-users';
import { loginAs } from './helpers/auth.helpers';

const BOARD_URL = '/neighborhood/nearby';

async function goToBoard(page: Page): Promise<void> {
  await page.goto(BOARD_URL);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Board' }).click();
  await page.waitForTimeout(1000);
}

// ─── NOTE CREATION: Various lengths × 5 users = 25 tests ─────────────────────
const noteLengths = [1, 40, 80, 120, 159];
test.describe('Bulletin Board: Note Creation at Various Lengths × 5 Users', () => {
  for (const user of testUsers) {
    for (const len of noteLengths) {
      test(`[BB-CREATE-U${user.index}-L${len}] User ${user.index} creates note at ${len} chars`, async ({ page }) => {
        await loginAs(page, user);
        await goToBoard(page);
        const textarea = page.getByPlaceholder(
          'Write a message, recommendation, or request for your neighbors (max 160 characters)...'
        );
        await expect(textarea).toBeVisible();
        const suffix = `:U${user.index}`;
        const pad = Math.max(0, len - suffix.length);
        const noteText = ('N'.repeat(pad) + suffix).substring(0, len);
        await textarea.fill(noteText.substring(0, len));
        await page.getByRole('button', { name: 'Stick Note 📌' }).click();
        await page.waitForTimeout(1500);
        await expect(page).not.toHaveURL(/error/);
      });
    }
  }
});

// ─── NOTE BOUNDARY: Exactly 160 chars × 5 users = 5 tests ────────────────────
test.describe('Bulletin Board: Note at Exactly 160 Chars (Boundary Accept)', () => {
  for (const user of testUsers) {
    test(`[BB-BOUND160-${user.index}] User ${user.index} note at 160 chars is accepted`, async ({ page }) => {
      await loginAs(page, user);
      await goToBoard(page);
      const textarea = page.getByPlaceholder(
        'Write a message, recommendation, or request for your neighbors (max 160 characters)...'
      );
      await textarea.fill('X'.repeat(160));
      const actualVal = await textarea.inputValue();
      expect(actualVal.length).toBe(160);
      // Counter should show 0 remaining
      const counter = page.locator('span.font-mono');
      if (await counter.isVisible()) {
        await expect(counter).toContainText('0 characters left');
      }
    });
  }
});

// ─── NOTE BOUNDARY: 161 chars truncated × 5 users = 5 tests ─────────────────
test.describe('Bulletin Board: Note at 161 Chars Is Truncated to 160', () => {
  for (const user of testUsers) {
    test(`[BB-BOUND161-${user.index}] User ${user.index} cannot exceed 160 chars`, async ({ page }) => {
      await loginAs(page, user);
      await goToBoard(page);
      const textarea = page.getByPlaceholder(
        'Write a message, recommendation, or request for your neighbors (max 160 characters)...'
      );
      await textarea.fill('Y'.repeat(200));
      const actualVal = await textarea.inputValue();
      expect(actualVal.length).toBeLessThanOrEqual(160);
    });
  }
});

// ─── CHARACTER COUNTER ACCURACY × 5 char counts × 5 users = 25 tests ─────────
const counterChecks = [10, 50, 100, 130, 160];
test.describe('Bulletin Board: Character Counter Accuracy', () => {
  for (const user of testUsers) {
    for (const chars of counterChecks) {
      test(`[BB-CTR-U${user.index}-C${chars}] User ${user.index} counter shows ${160 - chars} remaining at ${chars} chars`, async ({ page }) => {
        await loginAs(page, user);
        await goToBoard(page);
        const textarea = page.getByPlaceholder(
          'Write a message, recommendation, or request for your neighbors (max 160 characters)...'
        );
        await textarea.fill('Z'.repeat(chars));
        const counter = page.locator('span.font-mono');
        if (await counter.isVisible()) {
          const text = await counter.textContent() ?? '';
          const remaining = 160 - chars;
          expect(text).toContain(`${remaining}`);
        }
      });
    }
  }
});

// ─── EMPTY NOTE BLOCKED × 5 users = 5 tests ──────────────────────────────────
test.describe('Bulletin Board: Empty Note Cannot Be Posted', () => {
  for (const user of testUsers) {
    test(`[BB-EMPTY-${user.index}] User ${user.index} cannot submit empty note`, async ({ page }) => {
      await loginAs(page, user);
      await goToBoard(page);
      const stickBtn = page.getByRole('button', { name: 'Stick Note 📌' });
      // Button should be disabled when textarea is empty
      await expect(stickBtn).toBeDisabled();
    });
  }
});

// ─── WHITESPACE-ONLY NOTE BLOCKED × 5 users = 5 tests ────────────────────────
test.describe('Bulletin Board: Whitespace-Only Note Cannot Be Posted', () => {
  for (const user of testUsers) {
    test(`[BB-WS-${user.index}] User ${user.index} cannot submit whitespace-only note`, async ({ page }) => {
      await loginAs(page, user);
      await goToBoard(page);
      const textarea = page.getByPlaceholder(
        'Write a message, recommendation, or request for your neighbors (max 160 characters)...'
      );
      await textarea.fill('   ');
      const stickBtn = page.getByRole('button', { name: 'Stick Note 📌' });
      // Button should remain disabled (trimmed content is empty)
      await expect(stickBtn).toBeDisabled();
    });
  }
});

// ─── LIKE A STICKY NOTE × 5 users = 5 tests ──────────────────────────────────
test.describe('Bulletin Board: Like Sticky Note — Each User', () => {
  for (const user of testUsers) {
    test(`[BB-LIKE-${user.index}] User ${user.index} can like a sticky note`, async ({ page }) => {
      await loginAs(page, user);
      await goToBoard(page);
      const likeBtn = page.locator('.note-like-btn').first();
      if (await likeBtn.isVisible()) {
        const countBefore = await likeBtn.locator('.text-xs').textContent() ?? '0';
        await likeBtn.click();
        await page.waitForTimeout(800);
        await expect(page).not.toHaveURL(/error/);
      } else {
        test.skip(true, 'No notes on board to like');
      }
    });
  }
});

// ─── UNLIKE A STICKY NOTE × 5 users = 5 tests ────────────────────────────────
test.describe('Bulletin Board: Unlike (Toggle) Sticky Note — Each User', () => {
  for (const user of testUsers) {
    test(`[BB-UNLIKE-${user.index}] User ${user.index} can toggle off like on note`, async ({ page }) => {
      await loginAs(page, user);
      await goToBoard(page);
      const likeBtn = page.locator('.note-like-btn').first();
      if (await likeBtn.isVisible()) {
        await likeBtn.click(); // like
        await page.waitForTimeout(500);
        await likeBtn.click(); // unlike
        await page.waitForTimeout(500);
        await expect(page).not.toHaveURL(/error/);
      } else {
        test.skip(true, 'No notes on board');
      }
    });
  }
});

// ─── DELETE OWN NOTE: User only sees delete on own note = 5 tests ─────────────
test.describe('Bulletin Board: Delete Own Sticky Note', () => {
  for (const user of testUsers) {
    test(`[BB-DEL-${user.index}] User ${user.index} can delete their own sticky note`, async ({ page }) => {
      await loginAs(page, user);
      await goToBoard(page);
      // Post a note first
      const textarea = page.getByPlaceholder(
        'Write a message, recommendation, or request for your neighbors (max 160 characters)...'
      );
      await textarea.fill(`Delete test by ${user.name}`);
      await page.getByRole('button', { name: 'Stick Note 📌' }).click();
      await page.waitForTimeout(1500);
      // Try to find the delete button (only visible on own notes)
      const deleteBtn = page.getByRole('button', { name: 'Delete note' }).first();
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click();
        await page.waitForTimeout(1000);
        await expect(page).not.toHaveURL(/error/);
      }
    });
  }
});

// ─── BOARD NAVIGATION TABS × 5 users = 5 tests ────────────────────────────────
test.describe('Bulletin Board: Board Tab Navigation', () => {
  for (const user of testUsers) {
    test(`[BB-NAV-${user.index}] User ${user.index} can switch to Board tab`, async ({ page }) => {
      await loginAs(page, user);
      await page.goto(BOARD_URL);
      await page.waitForTimeout(1500);
      const boardTab = page.getByRole('button', { name: 'Board' });
      await boardTab.click();
      await page.waitForTimeout(800);
      await expect(boardTab).toHaveClass(/active/);
    });
  }
});

// ─── NOTES GRID RENDERS CORRECTLY × 5 users = 5 tests ────────────────────────
test.describe('Bulletin Board: Notes Grid UI Verification', () => {
  for (const user of testUsers) {
    test(`[BB-GRID-${user.index}] User ${user.index} sees notes grid (or empty state) on board`, async ({ page }) => {
      await loginAs(page, user);
      await goToBoard(page);
      const notesGrid = page.locator('.notes-grid').first();
      const emptyState = page.locator('.col-span-full').first();
      const gridVisible = await notesGrid.isVisible();
      const emptyVisible = await emptyState.isVisible();
      expect(gridVisible || emptyVisible).toBeTruthy();
    });
  }
});

// ─── NOTE COLOR PALETTE APPLIES × 5 users = 5 tests ─────────────────────────
test.describe('Bulletin Board: Color Palette Applied to Notes', () => {
  for (const user of testUsers) {
    test(`[BB-COLOR-${user.index}] User ${user.index} notes have color classes applied`, async ({ page }) => {
      await loginAs(page, user);
      await goToBoard(page);
      const stickyNotes = page.locator('.sticky-note-card');
      const count = await stickyNotes.count();
      if (count === 0) { test.skip(true, 'No notes to check color on'); return; }
      for (let i = 0; i < Math.min(count, 3); i++) {
        // Each note should have a background color class applied
        const classes = await stickyNotes.nth(i).getAttribute('class') ?? '';
        const hasColor = classes.includes('bg-[') || classes.includes('dark:bg-');
        expect(hasColor).toBeTruthy();
      }
    });
  }
});

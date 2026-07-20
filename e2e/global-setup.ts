// e2e/global-setup.ts
// Runs ONCE before all tests. Logs in each of the 5 test users and saves
// their authenticated session to disk. All tests then reuse these sessions,
// reducing Supabase auth calls from ~969 to just 5.

import { chromium, FullConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

interface TestUser {
  index: number;
  email: string;
  password: string;
  name: string;
}

const testUsers: TestUser[] = [
  { index: 1, email: process.env['E2E_USER1_EMAIL'] ?? 'e2e-user-1@example.invalid', password: process.env['E2E_USER1_PASSWORD'] ?? 'replace-with-test-password', name: 'UserOne' },
  { index: 2, email: process.env['E2E_USER2_EMAIL'] ?? 'e2e-user-2@example.invalid', password: process.env['E2E_USER2_PASSWORD'] ?? 'replace-with-test-password', name: 'UserTwo' },
  { index: 3, email: process.env['E2E_USER3_EMAIL'] ?? 'e2e-user-3@example.invalid', password: process.env['E2E_USER3_PASSWORD'] ?? 'replace-with-test-password', name: 'UserThree' },
  { index: 4, email: process.env['E2E_USER4_EMAIL'] ?? 'e2e-user-4@example.invalid', password: process.env['E2E_USER4_PASSWORD'] ?? 'replace-with-test-password', name: 'UserFour' },
  { index: 5, email: process.env['E2E_USER5_EMAIL'] ?? 'e2e-user-5@example.invalid', password: process.env['E2E_USER5_PASSWORD'] ?? 'replace-with-test-password', name: 'UserFive' },
];

export const SESSION_DIR = path.resolve(process.cwd(), 'e2e/.sessions');

async function globalSetup(config: FullConfig) {
  // Ensure session directory exists
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  const browser = await chromium.launch();
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://127.0.0.1:8788';

  for (const user of testUsers) {
    const sessionFile = path.join(SESSION_DIR, `user${user.index}.json`);

    // Access tokens are short-lived. Refresh before they can expire during a
    // long suite, otherwise tests can silently be redirected back to /login.
    if (fs.existsSync(sessionFile)) {
      const stat = fs.statSync(sessionFile);
      const ageMin = (Date.now() - stat.mtimeMs) / 60000;
      if (Number.isFinite(ageMin) && ageMin < 20) {
        console.log(`  ✓ Session for User ${user.index} cached (${ageMin.toFixed(1)}m old)`);
        continue;
      }
    }

    console.log(`  → Logging in User ${user.index} (${user.name})...`);
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();

    try {
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await page.getByPlaceholder('Email address').fill(user.email);
      await page.getByPlaceholder('Password').fill(user.password);
      await page.getByRole('button', { name: 'Log In' }).click();
      await page.waitForURL(/(?:\/$|\/(feed|hood|island))/, {
        timeout: 20000,
        waitUntil: 'domcontentloaded',
      });
      await page.goto('/feed', { waitUntil: 'domcontentloaded' });
      await context.storageState({ path: sessionFile });
      console.log(`  ✓ Session saved for User ${user.index}`);
    } catch (err) {
      console.error(`  ✗ Failed to login User ${user.index}: ${err}`);
    } finally {
      await context.close();
    }
  }

  await browser.close();
}

export default globalSetup;

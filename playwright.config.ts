import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

// User session paths (created by global-setup.ts)
const SESSION_DIR = path.resolve(__dirname, 'e2e/.sessions');

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Test artifacts go to e2e-artifacts/ (separate from JSON results in test-results/) */
  outputDir: 'e2e-artifacts',
  /* Global setup: pre-login all 5 users and cache sessions */
  globalSetup: './e2e/global-setup.ts',
  /* Keep dependent scenarios in each spec ordered; independent files use workers. */
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  /* Retry once for flakiness */
  retries: 1,
  /* 2 workers to avoid Supabase rate-limiting while still being parallel */
  workers: 2,
  /* Global timeout: 60 minutes. The PR suite should stay comfortably below this. */
  globalTimeout: 60 * 60 * 1000,
  /* Per-test timeout: 45 seconds */
  timeout: 45000,
  /* Multi-format reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://127.0.0.1:8788',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 20000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Default: use User 1 session (most tests override via loginAs())
        storageState: path.join(SESSION_DIR, 'user1.json'),
      },
    },
  ],

  webServer: {
    command: 'node scripts/serve-e2e.mjs',
    url: 'http://127.0.0.1:8788',
    reuseExistingServer: !process.env['CI'],
    timeout: 60 * 1000,
  },
});

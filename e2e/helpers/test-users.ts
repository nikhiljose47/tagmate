// e2e/helpers/test-users.ts
// Loads test user credentials from .env via dotenv (already loaded by playwright.config.ts)

export interface TestUser {
  email: string;
  password: string;
  name: string;
  index: number;
}

export const testUsers: TestUser[] = [
  {
    index: 1,
    email: process.env['E2E_USER1_EMAIL'] ?? 'e2e-user-1@example.invalid',
    password: process.env['E2E_USER1_PASSWORD'] ?? process.env['E2E_TEST_PASSWORD'] ?? 'replace-with-test-password',
    name: process.env['E2E_USER1_NAME'] ?? 'UserOne',
  },
  {
    index: 2,
    email: process.env['E2E_USER2_EMAIL'] ?? 'e2e-user-2@example.invalid',
    password: process.env['E2E_USER2_PASSWORD'] ?? process.env['E2E_TEST_PASSWORD'] ?? 'replace-with-test-password',
    name: process.env['E2E_USER2_NAME'] ?? 'UserTwo',
  },
  {
    index: 3,
    email: process.env['E2E_USER3_EMAIL'] ?? 'e2e-user-3@example.invalid',
    password: process.env['E2E_USER3_PASSWORD'] ?? process.env['E2E_TEST_PASSWORD'] ?? 'replace-with-test-password',
    name: process.env['E2E_USER3_NAME'] ?? 'UserThree',
  },
  {
    index: 4,
    email: process.env['E2E_USER4_EMAIL'] ?? 'e2e-user-4@example.invalid',
    password: process.env['E2E_USER4_PASSWORD'] ?? process.env['E2E_TEST_PASSWORD'] ?? 'replace-with-test-password',
    name: process.env['E2E_USER4_NAME'] ?? 'UserFour',
  },
  {
    index: 5,
    email: process.env['E2E_USER5_EMAIL'] ?? 'e2e-user-5@example.invalid',
    password: process.env['E2E_USER5_PASSWORD'] ?? process.env['E2E_TEST_PASSWORD'] ?? 'replace-with-test-password',
    name: process.env['E2E_USER5_NAME'] ?? 'UserFive',
  },
];

// All 10 unique user pairs (5C2)
export const userPairs: [TestUser, TestUser][] = [];
for (let i = 0; i < testUsers.length; i++) {
  for (let j = i + 1; j < testUsers.length; j++) {
    userPairs.push([testUsers[i], testUsers[j]]);
  }
}

// Post categories
export const postCategories = ['alert', 'event', 'sale', 'food', 'traffic', 'question', 'market'] as const;
export type PostCategory = typeof postCategories[number];

// Expiry options (labels as they appear in the UI)
export const expiryOptions = ['1h', '2h', '4h', '8h', '24h'];

// App themes
export const appThemes = ['light', 'dark', 'midnight', 'forest', 'sepia'] as const;
export type AppTheme = typeof appThemes[number];

// Protected routes (require authGuard)
export const protectedRoutes = [
  '/feed', '/hood', '/post', '/messages', '/reports', '/analytics', '/profile',
];

// Admin-only route
export const adminRoute = '/admin';

// Neighborhood slugs for testing
export const testNeighborhoodSlug = 'nearby';

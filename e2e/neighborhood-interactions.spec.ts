import { test, expect } from '@playwright/test';

const testUsers = [
  { email: 'user1@example.com', password: 'Password123!', name: 'UserOne' },
  { email: 'user2@example.com', password: 'Password123!', name: 'UserTwo' },
  { email: 'user3@example.com', password: 'Password123!', name: 'UserThree' },
  { email: 'user4@example.com', password: 'Password123!', name: 'UserFour' },
  { email: 'user5@example.com', password: 'Password123!', name: 'UserFive' },
];

test.describe('E2E Social Suite: Neighborhood Post & Interactions Matrix', () => {
  let postUrl: string;

  test('Should handle posting, multi-user likes, threaded replies, notifications, and cleanup', async ({ page, context }) => {
    // 1. User 1 logs in and publishes a post
    await page.goto('/login');
    await page.fill('input[placeholder="Email address"]', testUsers[0].email);
    await page.fill('input[placeholder="Password"]', testUsers[0].password);
    await page.click('button:has-text("Log In")');
    await expect(page).toHaveURL('/feed');

    // Go to posting view
    await page.goto('/post');
    await page.fill('textarea[name="headline"]', 'Community block cleanup drive this Saturday at 9 AM! Bring bags.');
    
    // Choose "Alert" category
    await page.click('button:has-text("Alert")');

    // Grant location permission and mock Bengaluru coordinate (12.9716, 77.5946)
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 12.9716, longitude: 77.5946 });
    
    // Select location
    await page.click('button:has-text("Current")');
    
    // Wait for the geocoded address display to load
    await page.waitForTimeout(1000);

    // Submit post
    await page.click('button[type="submit"]:has-text("Post")');

    // Verify redirect to detailed view and capture post URL
    await page.waitForURL(/\/posts\/.+/);
    postUrl = page.url();
    expect(postUrl).toContain('/posts/');

    // Log out User 1
    await page.click('button.user-menu-trigger');
    await page.click('button.danger:has-text("Sign out")');
    await expect(page).toHaveURL('/login');

    // 2. Users 2-5 log in, navigate directly to the post, like, and comment
    for (let i = 1; i < testUsers.length; i++) {
      const user = testUsers[i];
      const userContext = await context.browser().newContext();
      const userPage = await userContext.newPage();

      await userPage.goto('/login');
      await userPage.fill('input[placeholder="Email address"]', user.email);
      await userPage.fill('input[placeholder="Password"]', user.password);
      await userPage.click('button:has-text("Log In")');
      await expect(userPage).toHaveURL('/feed');

      // Go directly to the posted item
      await userPage.goto(postUrl);

      // Verify the details are loaded
      await expect(userPage.locator('.post-body')).toContainText('cleanup drive');

      // Like the post (toggles state)
      await userPage.click('button[aria-label="Like post"]');

      // Add a comment
      await userPage.fill('input[placeholder*="Add a comment"]', `Sounds great! User ${i + 1} will be there.`);
      await userPage.click('button[type="submit"]:has-text("Post")');

      // Add a nested reply on the first comment if User 3
      if (i === 2) {
        await userPage.click('button:has-text("Reply")');
        await userPage.fill('input[placeholder*="Reply"]', `@${testUsers[1].name} count me in to help organize!`);
        await userPage.click('button[type="submit"]:has-text("Reply")');
      }

      await userContext.close();
    }

    // 3. User 1 logs back in to check likes count, comments, and notification activity
    await page.goto('/login');
    await page.fill('input[placeholder="Email address"]', testUsers[0].email);
    await page.fill('input[placeholder="Password"]', testUsers[0].password);
    await page.click('button:has-text("Log In")');
    
    // Open post URL
    await page.goto(postUrl);

    // Verify UI display counts: 4 likes and 5 comments (4 comments + 1 nested reply)
    await expect(page.locator('.detail-counts')).toContainText('4 likes');
    await expect(page.locator('.detail-counts')).toContainText('5 comments');

    // Check Notifications drawer
    await page.click('button[aria-label="Notifications"]');
    const drawer = page.locator('.notification-drawer');
    await expect(drawer).toBeVisible();
    
    // Verify notification content exists for comments/likes
    await expect(drawer.locator('.notification-item')).toHaveCount({ min: 4 });

    // 4. Cleanup: delete the post to prevent test pollution
    await page.click('button[aria-label="More options"], .app-post-menu button');
    await page.click('button:has-text("Delete")');
    await page.waitForURL('/feed');
  });
});

import { expect, test } from '@playwright/test';

test.describe('Accessibility smoke checks', () => {
  test('login is keyboard-operable with labelled controls', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show password' })).toBeVisible();

    await page.getByLabel('Password').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Show password' })).toBeFocused();
  });
});

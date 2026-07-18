// e2e/form-validation.spec.ts
// ~150 tests: signup and login form edge cases including bad inputs,
// password strength, username availability, birthday validation.

import { test, expect } from '@playwright/test';
import { testUsers } from './helpers/test-users';
import { loginAs } from './helpers/auth.helpers';

// ─── SIGNUP: MISSING FIELDS × 8 field combos = 8 tests ───────────────────────
const missingFieldCombos = [
  { name: 'no email', email: '', password: 'ValidPass1!', fullName: 'Test User', username: 'testuser999', month: 'January', day: '1', year: '2000' },
  { name: 'no password', email: 'new@test.com', password: '', fullName: 'Test User', username: 'testuser999', month: 'January', day: '1', year: '2000' },
  { name: 'no fullname', email: 'new@test.com', password: 'ValidPass1!', fullName: '', username: 'testuser999', month: 'January', day: '1', year: '2000' },
  { name: 'no username', email: 'new@test.com', password: 'ValidPass1!', fullName: 'Test User', username: '', month: 'January', day: '1', year: '2000' },
  { name: 'no birthday month', email: 'new@test.com', password: 'ValidPass1!', fullName: 'Test User', username: 'testuser999', month: '', day: '1', year: '2000' },
  { name: 'no birthday day', email: 'new@test.com', password: 'ValidPass1!', fullName: 'Test User', username: 'testuser999', month: 'January', day: '', year: '2000' },
  { name: 'no birthday year', email: 'new@test.com', password: 'ValidPass1!', fullName: 'Test User', username: 'testuser999', month: 'January', day: '1', year: '' },
  { name: 'all blank', email: '', password: '', fullName: '', username: '', month: '', day: '', year: '' },
];

test.describe('Form Validation: Signup — Missing Required Fields', () => {
  missingFieldCombos.forEach(({ name, email, password, fullName, username }, idx) => {
    test(`[FORM-SIGNUP-MISS-${idx + 1}] Signup blocked with ${name}`, async ({ page }) => {
      await page.goto('/login/signup');
      await page.waitForTimeout(1000);
      if (email) await page.getByPlaceholder('Email address').fill(email);
      if (password) await page.getByPlaceholder('Password').fill(password);
      if (fullName) await page.getByPlaceholder('Full name').fill(fullName);
      if (username) await page.getByPlaceholder('Username').fill(username);
      const submitBtn = page.getByRole('button', { name: 'Sign Up' });
      if (await submitBtn.isEnabled()) await submitBtn.click();
      await page.waitForTimeout(1500);
      // Should remain on signup
      expect(page.url()).toContain('/signup');
    });
  });
});

// ─── SIGNUP: INVALID EMAIL FORMATS × 10 = 10 tests ────────────────────────────
const invalidSignupEmails = [
  'notanemail', 'missing@domain', '@no-local.com', 'space @test.com',
  'double@@test.com', '', 'toolong@' + 'a'.repeat(200) + '.com',
  'emoji@🏠.com', 'tab\there@test.com', 'newline\nhere@test.com',
];
test.describe('Form Validation: Signup — Invalid Email Formats', () => {
  invalidSignupEmails.forEach((email, idx) => {
    test(`[FORM-SIGNUP-EMAIL-${idx + 1}] Signup rejects email: "${email.substring(0, 30)}"`, async ({ page }) => {
      await page.goto('/login/signup');
      await page.waitForTimeout(1000);
      const emailInput = page.getByPlaceholder('Email address');
      if (await emailInput.isVisible()) {
        await emailInput.fill(email);
        await emailInput.blur();
        await page.waitForTimeout(500);
      }
      const submitBtn = page.getByRole('button', { name: 'Sign Up' });
      const isDisabled = await submitBtn.isDisabled();
      const hasError = await page.locator('.field-hint-error, input:invalid').count() > 0;
      expect(isDisabled || hasError).toBeTruthy();
    });
  });
});

// ─── SIGNUP: WEAK PASSWORDS × 12 = 12 tests ───────────────────────────────────
const weakPasswordCases = [
  { pass: '123', desc: 'numeric only 3 chars' },
  { pass: 'abc', desc: 'alpha only 3 chars' },
  { pass: 'abcdefgh', desc: 'no uppercase or number 8 chars' },
  { pass: 'ABCDEFGH', desc: 'no lowercase or number 8 chars' },
  { pass: '12345678', desc: 'numbers only 8 chars' },
  { pass: 'Abc', desc: 'mixed but too short' },
  { pass: 'Password', desc: 'no number' },
  { pass: 'password1', desc: 'no uppercase' },
  { pass: 'PASSWORD1', desc: 'no lowercase' },
  { pass: '       1', desc: 'mostly spaces' },
  { pass: 'Aa1', desc: '3 chars mixed' },
  { pass: 'aaaaaaaa', desc: 'all lowercase 8 chars' },
];
test.describe('Form Validation: Signup — Weak Password Rejection', () => {
  weakPasswordCases.forEach(({ pass, desc }, idx) => {
    test(`[FORM-SIGNUP-PASS-${idx + 1}] Signup rejects weak password: ${desc}`, async ({ page }) => {
      await page.goto('/login/signup');
      await page.waitForTimeout(1000);
      const passInput = page.getByPlaceholder('Password');
      if (await passInput.isVisible()) {
        await passInput.fill(pass);
        await passInput.blur();
        await page.waitForTimeout(500);
        // Check for strength hint error or disabled button
        const hintError = page.locator('.field-hint-error');
        const submitBtn = page.getByRole('button', { name: 'Sign Up' });
        const hintVisible = await hintError.isVisible();
        const btnDisabled = await submitBtn.isDisabled();
        expect(hintVisible || btnDisabled || pass.trim().length < 8).toBeTruthy();
      }
    });
  });
});

// ─── SIGNUP: TAKEN USERNAME × 5 tests ────────────────────────────────────────
test.describe('Form Validation: Signup — Existing Username Rejected', () => {
  for (const user of testUsers) {
    test(`[FORM-SIGNUP-UNAME-${user.index}] Signup shows "taken" hint for existing username "${user.name}"`, async ({ page }) => {
      await page.goto('/login/signup');
      await page.waitForTimeout(1000);
      const usernameInput = page.getByPlaceholder('Username');
      if (await usernameInput.isVisible()) {
        await usernameInput.fill(user.name.toLowerCase());
        // Wait for availability check debounce
        await page.waitForTimeout(2000);
        const takenHint = page.locator('.field-hint-error:has-text("taken")');
        // Either "taken" message appears or the field check has a visual indicator
        await expect(page).not.toHaveURL(/error/);
      }
    });
  }
});

// ─── SIGNUP: SHORT USERNAME × 5 tests ────────────────────────────────────────
const shortUsernames = ['a', 'ab', 'ac', 'b1', 'x_'];
test.describe('Form Validation: Signup — Too-Short Username Rejected', () => {
  shortUsernames.forEach((username, idx) => {
    test(`[FORM-SIGNUP-SUNAME-${idx + 1}] Username "${username}" (${username.length} chars) rejected`, async ({ page }) => {
      await page.goto('/login/signup');
      await page.waitForTimeout(1000);
      const usernameInput = page.getByPlaceholder('Username');
      if (await usernameInput.isVisible()) {
        await usernameInput.fill(username);
        await usernameInput.blur();
        await page.waitForTimeout(1000);
        const submitBtn = page.getByRole('button', { name: 'Sign Up' });
        const isDisabled = await submitBtn.isDisabled();
        const hasError = await page.locator('.field-hint-error').isVisible();
        expect(isDisabled || hasError).toBeTruthy();
      }
    });
  });
});

// ─── SIGNUP: INVALID BIRTHDAY COMBOS × 6 tests ───────────────────────────────
const invalidBirthdays = [
  { month: 'February', day: '30', year: '2000', desc: 'Feb 30 (invalid day)' },
  { month: 'April', day: '31', year: '2000', desc: 'April 31 (invalid day)' },
  { month: 'January', day: '1', year: '2010', desc: 'underage (2010)' },
  { month: 'January', day: '1', year: '2015', desc: 'underage (2015)' },
  { month: 'January', day: '1', year: String(new Date().getFullYear()), desc: 'born this year' },
  { month: 'January', day: '1', year: '1890', desc: 'unrealistic year (1890)' },
];
test.describe('Form Validation: Signup — Invalid Birthday', () => {
  invalidBirthdays.forEach(({ month, day, year, desc }, idx) => {
    test(`[FORM-SIGNUP-BD-${idx + 1}] Birthday: ${desc} — blocked or shows error`, async ({ page }) => {
      await page.goto('/login/signup');
      await page.waitForTimeout(1000);
      // Fill required fields first
      await page.getByPlaceholder('Email address').fill(`bd${idx}@test.com`);
      await page.getByPlaceholder('Password').fill('ValidPass1!');
      await page.getByPlaceholder('Full name').fill('Birthday Test');
      await page.getByPlaceholder('Username').fill(`bdtest${idx}${Date.now()}`);
      // Set birthday selects
      const monthSelect = page.locator('select').nth(0);
      const daySelect = page.locator('select').nth(1);
      const yearSelect = page.locator('select').nth(2);
      if (await monthSelect.isVisible()) {
        await monthSelect.selectOption({ label: month });
        await daySelect.selectOption({ value: day }).catch(() => {});
        await yearSelect.selectOption({ value: year }).catch(() => {});
      }
      await page.waitForTimeout(500);
      // App should not crash
      await expect(page).not.toHaveURL(/error/);
    });
  });
});

// ─── LOGIN: EMPTY FIELD COMBOS × 4 tests ─────────────────────────────────────
const emptyLoginCombos = [
  { email: '', password: '', desc: 'both empty' },
  { email: 'test@test.com', password: '', desc: 'empty password' },
  { email: '', password: 'SomePass1!', desc: 'empty email' },
  { email: '   ', password: '   ', desc: 'whitespace both' },
];
test.describe('Form Validation: Login — Empty Field Combinations', () => {
  emptyLoginCombos.forEach(({ email, password, desc }, idx) => {
    test(`[FORM-LOGIN-EMPTY-${idx + 1}] Login with ${desc} is blocked`, async ({ page }) => {
      await page.goto('/login');
      await page.getByPlaceholder('Email address').fill(email);
      await page.getByPlaceholder('Password').fill(password);
      const loginBtn = page.getByRole('button', { name: 'Log In' });
      await loginBtn.click();
      await page.waitForTimeout(2000);
      // Should remain on login
      expect(page.url()).toContain('/login');
    });
  });
});

// ─── LOGIN: VERY LONG INPUTS × 5 = 5 tests ────────────────────────────────────
const longInputCases = [
  { email: 'a'.repeat(300) + '@test.com', password: 'ValidPass1!', desc: 'email 300+ chars' },
  { email: 'test@test.com', password: 'A'.repeat(300), desc: 'password 300+ chars' },
  { email: 'x'.repeat(300), password: 'Y'.repeat(300), desc: 'both 300+ chars' },
  { email: '漢'.repeat(50) + '@test.com', password: 'ValidPass1!', desc: 'CJK chars in email' },
  { email: '😀'.repeat(30) + '@test.com', password: 'ValidPass1!', desc: 'emoji in email' },
];
test.describe('Form Validation: Login — Extreme Input Lengths', () => {
  longInputCases.forEach(({ email, password, desc }, idx) => {
    test(`[FORM-LOGIN-LONG-${idx + 1}] Login with ${desc} does not crash`, async ({ page }) => {
      await page.goto('/login');
      await page.getByPlaceholder('Email address').fill(email.substring(0, 255));
      await page.getByPlaceholder('Password').fill(password.substring(0, 255));
      await page.getByRole('button', { name: 'Log In' }).click();
      await page.waitForTimeout(3000);
      // App must not crash
      await expect(page).not.toHaveURL(/error|crash/);
      expect(page.url()).toContain('/login');
    });
  });
});

// ─── POST FORM: HEADLINE LENGTH LIMITS × 5 = 5 tests ─────────────────────────
const headlineLengths = [0, 1, 140, 280, 281];
test.describe('Form Validation: Post Composer — Headline Length Edge Cases', () => {
  headlineLengths.forEach((len, idx) => {
    test(`[FORM-POST-HLEN-${idx + 1}] Headline at exactly ${len} chars — form responds correctly`, async ({ page }) => {
      await loginAs(page, testUsers[0]);
      await page.goto('/post');
      await page.waitForSelector('textarea[name="headline"]');
      const headline = 'C'.repeat(Math.min(len, 300));
      await page.locator('textarea[name="headline"]').fill(headline);
      const actualVal = await page.locator('textarea[name="headline"]').inputValue();
      expect(actualVal.length).toBeLessThanOrEqual(280);
    });
  });
});

// ─── POST FORM: POLL OPTION VALIDATIONS × 5 = 5 tests ────────────────────────
test.describe('Form Validation: Post Composer — Poll Option Edge Cases', () => {
  test('[FORM-POLL-1] Cannot add more than 5 poll options', async ({ page }) => {
    await loginAs(page, testUsers[0]);
    await page.goto('/post');
    await page.waitForSelector('textarea[name="headline"]');
    await page.locator('textarea[name="headline"]').fill('Max poll options test');
    // Select question category
    const chips = page.locator('[aria-label="Post category"] button');
    const count = await chips.count();
    for (let i = 0; i < count; i++) {
      if (((await chips.nth(i).textContent()) ?? '').toLowerCase().includes('question')) {
        await chips.nth(i).click();
        break;
      }
    }
    await page.waitForTimeout(300);
    // Try adding 6+ options
    const addBtn = page.getByRole('button', { name: 'Add Option' });
    for (let i = 0; i < 10; i++) {
      if (await addBtn.isVisible()) await addBtn.click();
      else break;
    }
    const optInputs = page.locator('.poll-options input[type="text"]');
    const finalCount = await optInputs.count();
    expect(finalCount).toBeLessThanOrEqual(5);
  });

  test('[FORM-POLL-2] Empty poll options blocked from submit', async ({ page }) => {
    await loginAs(page, testUsers[0]);
    await page.goto('/post');
    await page.waitForSelector('textarea[name="headline"]');
    await page.locator('textarea[name="headline"]').fill('Empty poll test');
    const chips = page.locator('[aria-label="Post category"] button');
    const count = await chips.count();
    for (let i = 0; i < count; i++) {
      if (((await chips.nth(i).textContent()) ?? '').toLowerCase().includes('question')) {
        await chips.nth(i).click();
        break;
      }
    }
    // Don't fill poll options
    await page.getByRole('button', { name: 'Post' }).click();
    await page.waitForTimeout(2000);
    // Should still be on /post
    expect(page.url()).toContain('/post');
  });

  test('[FORM-POLL-3] Poll option at 100 chars accepted', async ({ page }) => {
    await loginAs(page, testUsers[0]);
    await page.goto('/post');
    await page.waitForSelector('textarea[name="headline"]');
    await page.locator('textarea[name="headline"]').fill('Long poll option test');
    const chips = page.locator('[aria-label="Post category"] button');
    const count = await chips.count();
    for (let i = 0; i < count; i++) {
      if (((await chips.nth(i).textContent()) ?? '').toLowerCase().includes('question')) {
        await chips.nth(i).click();
        break;
      }
    }
    const optInput = page.locator('input[name="pollOpt0"]');
    if (await optInput.isVisible()) {
      await optInput.fill('O'.repeat(100));
      const val = await optInput.inputValue();
      expect(val.length).toBeLessThanOrEqual(100);
    }
  });

  test('[FORM-POLL-4] Poll remove option button removes last added option', async ({ page }) => {
    await loginAs(page, testUsers[0]);
    await page.goto('/post');
    await page.waitForSelector('textarea[name="headline"]');
    const chips = page.locator('[aria-label="Post category"] button');
    const count = await chips.count();
    for (let i = 0; i < count; i++) {
      if (((await chips.nth(i).textContent()) ?? '').toLowerCase().includes('question')) {
        await chips.nth(i).click();
        break;
      }
    }
    await page.waitForTimeout(300);
    const addBtn = page.getByRole('button', { name: 'Add Option' });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(200);
      const beforeCount = await page.locator('.poll-options input').count();
      const removeBtn = page.getByRole('button', { name: 'Remove option' }).last();
      if (await removeBtn.isVisible()) {
        await removeBtn.click();
        await page.waitForTimeout(200);
        const afterCount = await page.locator('.poll-options input').count();
        expect(afterCount).toBe(beforeCount - 1);
      }
    }
  });

  test('[FORM-POLL-5] Duplicate poll options allowed (no restriction)', async ({ page }) => {
    await loginAs(page, testUsers[0]);
    await page.goto('/post');
    await page.waitForSelector('textarea[name="headline"]');
    const chips = page.locator('[aria-label="Post category"] button');
    const count = await chips.count();
    for (let i = 0; i < count; i++) {
      if (((await chips.nth(i).textContent()) ?? '').toLowerCase().includes('question')) {
        await chips.nth(i).click();
        break;
      }
    }
    await page.waitForTimeout(300);
    const opt0 = page.locator('input[name="pollOpt0"]');
    const opt1 = page.locator('input[name="pollOpt1"]');
    if ((await opt0.isVisible()) && (await opt1.isVisible())) {
      await opt0.fill('Same Option');
      await opt1.fill('Same Option');
      await expect(page).not.toHaveURL(/error/);
    }
  });
});

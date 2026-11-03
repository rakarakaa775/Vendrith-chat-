import { expect, test } from '@playwright/test';

const accountEmail = process.env.E2E_ACCOUNT_1_EMAIL;
const accountPassword = process.env.E2E_ACCOUNT_1_PASSWORD;
const supabaseConfigured = process.env.E2E_SUPABASE_AUTH === '1';

test('shows the protected non-production sign-in state to an unauthenticated visitor', async ({ page }) => {
  test.skip(!supabaseConfigured, 'Requires the explicitly configured non-production Supabase environment.');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Authentication required' })).toBeVisible();
  await page.getByRole('link', { name: 'Continue to sign in' }).click();
  await expect.poll(() => page.url()).toContain('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByText('NON-PRODUCTION TEST ENVIRONMENT')).toBeVisible();
});

test('signs in with the configured non-production E2E account and opens server chat', async ({ page }) => {
  test.skip(!supabaseConfigured || !accountEmail || !accountPassword, 'Requires GitHub Actions Non-Production Supabase URL, publishable key, and E2E account credentials.');
  await page.goto('/login');
  await page.getByLabel('Email address').fill(accountEmail!);
  await page.getByLabel('Password').fill(accountPassword!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect.poll(() => page.url(), { timeout: 30_000 }).toMatch(/\/$/);
  await expect(page.getByRole('heading', { name: 'Vendrith Chat' })).toBeVisible();
  await expect(page.getByText(accountEmail!, { exact: true })).toBeVisible();
  await expect(page.getByText(/server-backed conversation\(s\) loaded|No conversations yet\. Start one/i)).toBeVisible({ timeout: 30_000 });
});

test('provides email and password registration and sign-in modes', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await page.getByRole('button', { name: 'Need an account? Create one' }).click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.getByLabel('Password')).toHaveAttribute('autocomplete', 'new-password');
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
});

test('exposes a password recovery request page', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect.poll(() => page.url()).toContain('/forgot-password');
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
});
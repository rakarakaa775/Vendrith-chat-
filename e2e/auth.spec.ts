import { expect, test } from '@playwright/test';

test('redirects unauthenticated visitors to the non-production sign-in screen', async ({ page }) => {
  test.skip(process.env.E2E_SUPABASE_AUTH !== '1', 'Requires the explicitly configured non-production Supabase environment.');
  await page.goto('/');
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByText('NON-PRODUCTION TEST ENVIRONMENT')).toBeVisible();
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
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
});

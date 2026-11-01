import { expect, test } from '@playwright/test';

test('redirects unauthenticated visitors to the non-production sign-in screen', async ({ page }) => {
  test.skip(process.env.E2E_SUPABASE_AUTH !== '1', 'Requires the explicitly configured non-production Supabase environment.');
  await page.goto('/');
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByText('NON-PRODUCTION TEST ENVIRONMENT')).toBeVisible();
});


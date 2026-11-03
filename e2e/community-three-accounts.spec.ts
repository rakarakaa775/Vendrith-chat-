import { expect, test, type Browser, type BrowserContext } from '@playwright/test';

const accounts = [
  { username: 'raka11', email: process.env.E2E_ACCOUNT_1_EMAIL, password: process.env.E2E_ACCOUNT_1_PASSWORD },
  { username: 'raka990', email: process.env.E2E_ACCOUNT_2_EMAIL, password: process.env.E2E_ACCOUNT_2_PASSWORD },
  { username: 'raka099', email: process.env.E2E_ACCOUNT_3_EMAIL, password: process.env.E2E_ACCOUNT_3_PASSWORD },
];

const configured = accounts.every((account) => Boolean(account.email && account.password));

test('three existing accounts can sign in and discover each other in Community', async ({ browser }) => {
  test.skip(!configured, 'Set E2E_ACCOUNT_1/2/3_EMAIL and E2E_ACCOUNT_1/2/3_PASSWORD as secure environment secrets.');

  const contexts: BrowserContext[] = [];
  try {
    const pages = [];
    for (const account of accounts) {
      const context = await createIsolatedContext(browser);
      contexts.push(context);
      const page = await context.newPage();
      await page.goto('/login');
      await page.getByLabel('Email address').fill(account.email!);
      await page.getByLabel('Password').fill(account.password!);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page).toHaveURL(/\/$/);
      await page.goto('/community');
      await expect(page.getByRole('heading', { name: 'Friends & Community' })).toBeVisible();
      await expect(page.getByLabel('Username')).toHaveValue(account.username);
      await expect(page.getByText('Community data synchronized with the Non-Production server.')).toBeVisible();
      pages.push(page);
    }

    // Read-only discovery checks: no friend requests, blocks, profile edits, or deletions.
    for (let index = 0; index < pages.length; index += 1) {
      for (let other = 0; other < accounts.length; other += 1) {
        if (other === index) continue;
        const page = pages[index];
        await page.getByRole('textbox', { name: 'Search players' }).fill(accounts[other].username);
        await expect(page.getByText(`@${accounts[other].username}`, { exact: true })).toBeVisible();
      }
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

async function createIsolatedContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext();
}

import { expect, test } from '@playwright/test';

test('saves a message across refresh and conversation switching', async ({ page }) => {
  await page.goto('/');
  const composer = page.getByRole('textbox', { name: 'Message composer' });
  await composer.fill('Phase 2 browser persistence check');
  await page.getByRole('button', { name: 'Save message locally' }).click();
  await expect(page.getByRole('region', { name: 'Conversation' }).getByText('Phase 2 browser persistence check')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Conversation' }).getByText('Saved on this device').last()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('region', { name: 'Conversation' }).getByText('Phase 2 browser persistence check')).toBeVisible();

  await page.getByRole('button', { name: /Thorne Ashford/ }).click();
  await expect(page.getByRole('region', { name: 'Conversation' }).getByText('Did you find the map fragment?')).toBeVisible();
  await page.getByRole('button', { name: /Elaria Moonwhisper/ }).click();
  await expect(page.getByRole('region', { name: 'Conversation' }).getByText('Phase 2 browser persistence check')).toBeVisible();
});

test('preserves the draft and retries a transient storage failure once', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const originalSetItem = Storage.prototype.setItem;
    let shouldFail = true;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (shouldFail && key === 'vendrith-chat:local:v1') {
        shouldFail = false;
        throw new DOMException('Simulated quota failure', 'QuotaExceededError');
      }
      return originalSetItem.call(this, key, value);
    };
  });

  const composer = page.getByRole('textbox', { name: 'Message composer' });
  await composer.fill('Retry without losing this draft');
  await page.getByRole('button', { name: 'Save message locally' }).click();
  await expect(page.getByText('Simulated quota failure')).toBeVisible();
  await expect(composer).toHaveValue('Retry without losing this draft');

  await page.getByRole('button', { name: /Retry saving to Elaria Moonwhisper/ }).click();
  await expect(page.getByRole('region', { name: 'Conversation' }).getByText('Retry without losing this draft')).toBeVisible();
  await expect(composer).toHaveValue('');
  await expect(page.getByRole('button', { name: /Retry saving/ })).toHaveCount(0);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('vendrith-chat:local:v1') || '{}'));
  const matches = saved.conversations.elaria.filter((message: { body: string }) => message.body === 'Retry without losing this draft');
  expect(matches).toHaveLength(1);
});

test('supports mobile conversation navigation and local message composition', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Conversation' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to conversations' }).click();
  await page.getByRole('button', { name: /Thorne Ashford/ }).click();
  await expect(page.getByRole('region', { name: 'Conversation' }).getByText('Did you find the map fragment?')).toBeVisible();
  await page.getByRole('textbox', { name: 'Message composer' }).fill('Mobile browser check');
  await page.getByRole('button', { name: 'Save message locally' }).click();
  await expect(page.getByRole('region', { name: 'Conversation' }).getByText('Mobile browser check')).toBeVisible();
});

import { test, expect } from '@playwright/test';

test('login, save and reopen design, preview and logout', async ({ page }) => {
  const password = process.env.PB_TEST_PASSWORD;
  test.skip(!password, 'Set PB_TEST_PASSWORD for your local test account.');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('Username', { exact: true }).fill(process.env.PB_TEST_USERNAME || 'admin');
  await page.getByLabel('Password', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Page Builder', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Open saved page', exact: true }).selectOption('CONTACT_FORM');
  await expect(page.locator('.pb-control-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel('Contact name')).toBeVisible();
  await page.keyboard.press('Escape');
  // The real save/reload path, including generated metadata tables.
  const response = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().includes('/api/GenericPages/CONTACT_FORM'));
  await page.getByRole('button', { name: 'Save page', exact: true }).click();
  expect((await response).status()).toBe(200);
  await page.reload();
  await page.getByRole('combobox', { name: 'Open saved page', exact: true }).selectOption('CONTACT_FORM');
  await expect(page.locator('.pb-control-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

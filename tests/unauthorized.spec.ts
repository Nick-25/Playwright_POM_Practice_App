import { expect, test } from '@playwright/test';

test.describe('unauthorized access', () => {
  for (const path of ['/profile', '/todos']) {
    test(`redirects signed-out users from ${path}`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL('/unauthorized');
      await expect(page.getByTestId('unauthorized-page')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'You need to log in first.' })).toBeVisible();
      await expect(page.getByTestId('back-to-welcome')).toHaveAttribute('href', '/');
    });
  }

  test('returns signed-out users to the welcome page', async ({ page }) => {
    await page.goto('/unauthorized');
    await page.getByTestId('back-to-welcome').click();

    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('public-welcome')).toBeVisible();
  });
});

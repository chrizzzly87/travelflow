import { expect, test } from '@playwright/test';

test('homepage renders primary navigation', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/TravelFlow/i);
    await expect(page.getByRole('link', { name: 'Features' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Updates' }).first()).toBeVisible();
});

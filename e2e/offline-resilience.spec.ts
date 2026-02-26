import { expect, test } from '@playwright/test';

const OFFLINE_TITLE = 'You are offline. Changes will be queued.';
const RETRY_HINT = 'Retrying Supabase connection every 30s while this tab stays open.';

test.describe('Supabase outage resilience', () => {
    test('forced outage query shows offline banner, retry cadence hint, and support actions', async ({ page }) => {
        await page.goto('/create-trip?offline=offline');

        await expect(page.getByText(OFFLINE_TITLE)).toBeVisible();
        await expect(page.getByText(RETRY_HINT)).toBeVisible();
        await expect(page.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', /\/contact$/);
        await expect(page.getByRole('link', { name: 'Email support' })).toHaveAttribute('href', /^mailto:/);
    });

    test('navigator.onLine network emulation toggles browser online status', async ({ context, page }) => {
        const readOnlineStatus = async (): Promise<boolean | null> => {
            try {
                return await page.evaluate(() => navigator.onLine);
            } catch {
                return null;
            }
        };

        await page.goto('/create-trip');

        await context.setOffline(true);

        await expect.poll(readOnlineStatus).toBe(false);

        await context.setOffline(false);
        await expect.poll(readOnlineStatus).toBe(true);
    });

    test('dismiss keeps banner hidden for same forced-outage state within session', async ({ page }) => {
        await page.goto('/create-trip?offline=offline');
        await expect(page.getByText(OFFLINE_TITLE)).toBeVisible();

        await page.getByLabel('Dismiss connectivity banner').click();
        await expect(page.getByText(OFFLINE_TITLE)).toHaveCount(0);

        await page.reload();
        await expect(page.getByText(OFFLINE_TITLE)).toHaveCount(0);
    });
});

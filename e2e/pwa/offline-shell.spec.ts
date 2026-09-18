import { expect, test, type Page } from '@playwright/test';

/**
 * The regression test for the actual failure this feature fixes: before the
 * service worker existed, a home-screen launch with no network showed the
 * browser's offline error, because Safari could not fetch the app's own HTML
 * and JavaScript. Everything downstream (local trip storage, the offline-aware
 * trip loader) already worked but was unreachable.
 *
 * Requires a production build in `dist/` — see `playwright.pwa.config.ts`.
 */

const TRIP_ID = 'e2e-offline-trip';
const TRIP_TITLE = 'Offline Taiwan Loop';

const seedLocalTrip = async (page: Page): Promise<void> => {
    await page.evaluate(({ id, title }) => {
        const now = Date.now();
        const trip = {
            id,
            title,
            items: [
                { id: 'city-1', type: 'city', name: 'Taipei' },
                { id: 'city-2', type: 'city', name: 'Tainan' },
            ],
            createdAt: now,
            updatedAt: now,
            isFavorite: false,
            isPinned: false,
            showOnPublicProfile: true,
            status: 'active',
            tripExpiresAt: null,
        };
        window.localStorage.setItem('travelflow_trips_v1', JSON.stringify([trip]));
    }, { id: TRIP_ID, title: TRIP_TITLE });
};

const waitForController = async (page: Page): Promise<void> => {
    await page.waitForFunction(
        () => Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
        undefined,
        { timeout: 30_000 }
    );
};

test.describe('offline app shell', () => {
    test('installs a worker, then boots /trips and a trip with the network off', async ({ page, context }) => {
        await page.goto('/trips');
        await waitForController(page);

        await seedLocalTrip(page);

        await page.goto('/trips');
        await expect(page.getByText(TRIP_TITLE).first()).toBeVisible({ timeout: 20_000 });

        // Warm the trip route's lazy chunks while still online. This is the
        // documented offline contract: a route works offline after it has been
        // opened online at least once on the device. The trip itself is local
        // only, so it does not render here — the loader asks the database when
        // it believes it is online — but the chunks are what we need cached.
        await page.goto(`/trip/${TRIP_ID}`);
        await page.waitForLoadState('networkidle');

        await context.setOffline(true);

        // Cold reload with no network: this is the case that used to fail
        // outright, with the browser's own offline error page.
        await page.goto('/trips');
        await expect(page.getByText(TRIP_TITLE).first()).toBeVisible({ timeout: 20_000 });

        // And the trip itself resolves from local storage once the loader knows
        // it is offline.
        await page.goto(`/trip/${TRIP_ID}`);
        await expect(page.getByText(TRIP_TITLE).first()).toBeVisible({ timeout: 20_000 });

        await context.setOffline(false);
    });

    test('serves a valid, stamped worker and manifest', async ({ page, request }) => {
        const worker = await request.get('/sw.js');
        expect(worker.ok()).toBe(true);
        const workerSource = await worker.text();
        expect(workerSource).not.toContain('__BUILD_HASH__');
        expect(workerSource).not.toContain('__PRECACHE_MANIFEST__');

        const manifest = await request.get('/manifest.webmanifest');
        expect(manifest.ok()).toBe(true);
        const parsed = await manifest.json() as {
            start_url: string;
            display: string;
            icons: Array<{ src: string; sizes: string }>;
        };
        expect(parsed.start_url).toBe('/trips?source=pwa');
        expect(parsed.display).toBe('standalone');
        expect(parsed.icons.map((icon) => icon.sizes)).toContain('512x512');

        await page.goto('/');
        await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
            'href',
            '/manifest.webmanifest'
        );
        await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
            'content',
            'yes'
        );
    });

    test('never caches account API responses', async ({ page }) => {
        await page.goto('/trips');
        await waitForController(page);

        const cachedApiUrls = await page.evaluate(async () => {
            const names = await caches.keys();
            const urls: string[] = [];
            for (const name of names) {
                const cache = await caches.open(name);
                for (const request of await cache.keys()) {
                    urls.push(request.url);
                }
            }
            return urls.filter((url) => new URL(url).pathname.startsWith('/api/'));
        });

        const disallowed = cachedApiUrls.filter(
            (url) => new URL(url).pathname !== '/api/trip-map-preview'
        );
        expect(disallowed).toEqual([]);
    });
});

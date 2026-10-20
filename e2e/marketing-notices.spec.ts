import { expect, test, type Page } from '@playwright/test';

// Browser language intentionally differs from the page locale so both real
// notices are present. Their combined height must belong to the document flow.
test.use({ locale: 'de-DE', viewport: { width: 1365, height: 900 } });
const suggestion = (page: Page) => page.locator('[data-tf-track-event="navigation__language_suggestion--dismiss"]').locator('..').locator('..');
const translation = (page: Page) => page.locator('[data-tf-track-event="i18n_notice__dismiss"]').locator('..').locator('..');

async function expectNoticesBeforeContent(page: Page) {
    const language = suggestion(page);
    const notice = translation(page);
    await expect(language).toBeVisible();
    await expect(notice).toBeVisible();
    const boxes = await Promise.all([page.locator('header').first(), language, notice, page.locator('main h1').first()].map(node => node.boundingBox()));
    expect(boxes.every(Boolean)).toBe(true);
    const [header, suggested, translated, heading] = boxes.map(box => box!);
    expect(suggested.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
    expect(translated.y).toBeGreaterThanOrEqual(suggested.y + suggested.height - 1);
    expect(heading.y).toBeGreaterThanOrEqual(translated.y + translated.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const route of ['/fr/updates', '/fa/updates']) {
    test(`${route} keeps stacked notices above content through resize and dismissal`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/ci-placeholder.supabase.co/**', request => request.fulfill({ json: [] }));
        await page.goto(route);
        await page.waitForFunction(() => (window as Window & { __TF_BOOT__?: { sealed: boolean } }).__TF_BOOT__?.sealed);
        await expect(page.locator('html')).toHaveAttribute('dir', route.startsWith('/fa') ? 'rtl' : 'ltr');
        await expectNoticesBeforeContent(page);
        await page.setViewportSize({ width: 320, height: 740 });
        await expectNoticesBeforeContent(page);
        await page.setViewportSize({ width: 800, height: 900 });
        await expectNoticesBeforeContent(page);
        const originalHeading = await page.locator('main h1').first().textContent();
        const initialTop = (await page.locator('main h1').first().boundingBox())!.y;
        await page.locator('[data-tf-track-event="navigation__language_suggestion--dismiss"]').click();
        await expect(suggestion(page)).toHaveCount(0);
        await expect(translation(page)).toBeVisible();
        const remaining = (await translation(page).boundingBox())!;
        const afterSuggestionTop = (await page.locator('main h1').first().boundingBox())!.y;
        expect(afterSuggestionTop).toBeLessThan(initialTop);
        expect(afterSuggestionTop).toBeGreaterThanOrEqual(remaining.y + remaining.height);
        await page.locator('[data-tf-track-event="i18n_notice__dismiss"]').click();
        await expect(translation(page)).toHaveCount(0);
        expect((await page.locator('main h1').first().boundingBox())!.y).toBeLessThan(afterSuggestionTop);
        await expect(page.locator('main h1').first()).toHaveText(originalHeading!);
        expect(errors).toEqual([]);
    });
}

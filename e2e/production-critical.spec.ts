import { expect, test, type Page } from '@playwright/test';
import LZString from 'lz-string';

let pageErrors: string[];
let assetErrors: string[];
test.beforeEach(async ({ page }) => {
  pageErrors = [];
  assetErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /hydration|Minified React error #(418|421|422|423|425)|server HTML|did not match|Suspense boundary.*hydrating/i.test(message.text())) pageErrors.push(message.text());
  });
  page.on('requestfailed', request => {
    if (/\/assets\/.*\.(js|css)(\?|$)/.test(request.url())) {
      console.warn(`Asset request failed: ${request.failure()?.errorText} ${request.url()}`);
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && /\/assets\/.*\.(js|css)(\?|$)/.test(response.url())) {
      assetErrors.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.route('**/ci-placeholder.supabase.co/**', (request) => request.fulfill({ json: [] }));
});
test.afterEach(() => {
  expect(pageErrors).toEqual([]);
  expect(assetErrors).toEqual([]);
});

const holdApplicationScripts = async (page: Page) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/assets/*.js', async (request) => {
    await gate;
    await request.continue();
  });
  return release;
};

for (const route of ['/', '/features', '/pricing', '/blog', '/inspirations', '/faq', '/updates']) {
  test(`${route} keeps prerendered content and becomes interactive`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('#root[data-tf-prerendered-root="true"]')).toBeVisible();
    await expect(page.locator('main h1').first()).toBeVisible();
    const initialHeading = await page.locator('main h1').first().textContent();
    await expect(page.locator('footer').first()).toBeVisible();
    await expect(page.locator('[data-tf-error-boundary="true"]')).toHaveCount(0);
    await page.waitForFunction(() => (window as Window & { __TF_BOOT__?: { sealed: boolean } }).__TF_BOOT__?.sealed);
    await page.getByRole('combobox', { name: 'Language', exact: true }).click();
    await page.getByRole('option', { name: 'Deutsch', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/de${route === '/' ? '/?$' : route + '$'}`));
    await expect(page.locator('footer').first()).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await page.goBack();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('main h1').first()).toHaveText(initialHeading!);
  });
}

test('a hosted directory URL keeps its page when changing language', async ({ page }) => {
  await page.goto('/features/');
  const heading = await page.locator('main h1').first().textContent();
  await page.waitForFunction(() => (window as Window & { __TF_BOOT__?: { sealed: boolean } }).__TF_BOOT__?.sealed);
  await page.getByRole('combobox', { name: 'Language', exact: true }).click();
  await page.getByRole('option', { name: 'Deutsch', exact: true }).click();
  await expect(page).toHaveURL(/\/de\/features\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await page.goBack();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('main h1').first()).toHaveText(heading!);
});

test.describe('mobile first tap', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  for (const route of ['/', '/features']) {
    test(`${route} accepts the first mobile menu tap before hydration`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const release = await holdApplicationScripts(page);
      await page.goto(route, { waitUntil: 'commit' });
      const menuButton = page.locator('[data-tf-boot-intent]').first();
      await expect(menuButton).toBeVisible();
      await menuButton.tap();
      await expect(menuButton).toHaveAttribute('data-tf-boot-pending', 'true');
      release();
      await expect(page.getByRole('dialog', { name: 'Navigation menu' })).toBeVisible();
    });
  }
});

for (const locale of ['de', 'fa']) {
  test(`a cold ${locale} landing page preserves its locale and first interaction`, async ({ page }) => {
    const release = await holdApplicationScripts(page);
    await page.goto(`/${locale}`, { waitUntil: 'commit' });
    await expect(page.locator('#root[data-tf-prerendered-root="true"]')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'fa' ? 'rtl' : 'ltr');
    const theme = page.locator('[data-tf-boot-replay^="theme:"]').first();
    await theme.click();
    release();
    await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 15_000 });
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('main h1').first()).toBeVisible();
  });
}

for (const route of ['/create-trip', '/create-trip/wizard', '/example/thailand-islands']) {
  test(`${route} opens through its native client route boundary`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Your next adventure/ })).toHaveCount(0);
    await expect(page.locator('[data-tf-error-boundary="true"]')).toHaveCount(0);
    if (route === '/create-trip/wizard') {
      await page.getByRole('button', { name: /I know the destinations and exact dates/ }).click();
      await expect(page.getByPlaceholder('Search country or island')).toBeVisible();
    } else if (route === '/create-trip') {
      const search = page.getByPlaceholder('Search country or island');
      await search.fill('Japan');
      await page.getByRole('button', { name: 'Japan', exact: true }).click();
      await expect(search).toHaveValue('');
      await expect(page.getByRole('button', { name: 'Remove Japan' })).toBeVisible();
    } else {
      await page.getByRole('button', { name: /Open trip details/ }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    }
  });
}

for (const control of ['theme', 'faq', 'language']) {
  test(`${control} accepts a click before application JavaScript loads`, async ({ page }) => {
    const release = await holdApplicationScripts(page);
    await page.goto(control === 'faq' ? '/faq' : '/features', { waitUntil: 'commit' });
    if (control === 'theme') {
      await page.getByRole('button', { name: 'Switch to dark mode' }).click();
      release();
      await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 15_000 });
    } else if (control === 'faq') {
      const question = page.locator('button[id^="faq-trigger-"]').first();
      await question.click();
      release();
      await expect(question).toHaveAttribute('aria-expanded', 'false', { timeout: 15_000 });
    } else {
      await page.getByRole('combobox', { name: 'Language', exact: true }).click();
      release();
      await expect(page.getByRole('option', { name: 'Deutsch', exact: true })).toBeVisible({ timeout: 15_000 });
      await page.getByRole('option', { name: 'Deutsch', exact: true }).click();
      await expect(page).toHaveURL(/\/de\/features$/);
    }
  });
}

test('an encoded trip opens its details and mobile navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const trip = {
    id: 'runtime-regression-trip', title: 'Runtime Taiwan Loop', startDate: '2027-04-01',
    createdAt: 1_800_000_000_000, updatedAt: 1_800_000_000_000,
    items: [{ id: 'taipei', type: 'city', title: 'Taipei', startDateOffset: 0, duration: 3, color: '#6366f1', coordinates: { lat: 25.03, lng: 121.56 } }],
  };
  const encoded = LZString.compressToEncodedURIComponent(JSON.stringify({ trip }));
  await page.goto(`/trip/${encoded}`);
  await expect(page.getByText(trip.title).first()).toBeVisible();
  await page.getByTestId('trip-header-menu').click();
  await expect(page.getByRole('dialog', { name: 'Navigation menu' })).toBeVisible();
  await page.getByRole('button', { name: 'Close menu', exact: true }).click();
  await page.getByRole('button', { name: /Open trip details/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Edit Title', exact: true }).click();
  const title = dialog.getByRole('textbox', { name: 'Trip title', exact: true });
  await title.fill('Runtime Taiwan Loop edited');
  await title.press('Enter');
  await expect(title).toHaveValue('Runtime Taiwan Loop edited');
  await expect(title).toBeDisabled();
});

for (const choice of [{ label: 'Essential only', stored: 'essential' }, { label: 'Accept all', stored: 'all' }]) {
  test(`cookie banner accepts ${choice.stored} on the first click after an early interaction`, async ({ page }) => {
    const release = await holdApplicationScripts(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.mouse.wheel(0, 80);
    release();
    const button = page.getByRole('button', { name: choice.label, exact: true });
    await expect(button).toBeVisible();
    await button.click();
    await expect(button).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('tf_cookie_consent_choice_v1'))).toBe(choice.stored);
    await page.reload();
    await page.mouse.wheel(0, 80);
    await page.waitForFunction(() => (window as Window & { __TF_BOOT__?: { sealed: boolean } }).__TF_BOOT__?.sealed);
    await expect(page.getByRole('button', { name: choice.label, exact: true })).toHaveCount(0);
  });
}

test('cookie banner cannot cover a press that starts before hydration', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const release = await holdApplicationScripts(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const cta = page.getByRole('link', { name: 'Start Planning', exact: true });
  await cta.evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 730));
  const box = await cta.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  release();
  await page.waitForFunction(() => (window as Window & { __TF_BOOT__?: { sealed: boolean } }).__TF_BOOT__?.sealed);
  // Wait for the queued banner task while the original press is still held.
  await page.waitForTimeout(250);
  await expect(page.getByRole('button', { name: 'Accept all', exact: true })).toHaveCount(0);
  await page.mouse.up();
  await expect(page).toHaveURL(/\/create-trip\/?$/);
  expect(await page.evaluate(() => localStorage.getItem('tf_cookie_consent_choice_v1'))).toBeNull();
});

test('the wizard hydrates from initial locale resources without a separate namespace download', async ({ page }) => {
  let namespaceRequests = 0;
  await page.route('**/assets/createTrip-*.js', async request => {
    namespaceRequests += 1;
    await request.abort('failed');
  });
  await page.goto('/create-trip/wizard');
  await expect(page.getByRole('button', { name: /I know the destinations and exact dates/ })).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: /I know the destinations and exact dates/ }).click();
  await expect(page.getByPlaceholder('Search country or island')).toBeVisible();
  expect(namespaceRequests).toBe(0);
});

test('an unprefixed wizard restores its saved language after document hydration', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tf_app_language', 'de'));
  await page.goto('/create-trip/wizard');
  await expect(page.getByRole('button', { name: /Ich kenne Ziele und genaue Daten/ })).toBeVisible({ timeout: 8000 });
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  expect(await page.evaluate(() => localStorage.getItem('tf_app_language'))).toBe('de');
});

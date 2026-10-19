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

test('desktop-only hero artwork follows the viewport before hydration', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const artworkRequests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('plane-window')) artworkRequests.push(request.url());
  });
  const release = await holdApplicationScripts(page);
  try {
    await page.goto('/', { waitUntil: 'commit' });
    const frame = page.locator('.plane-window-wrapper img');
    await expect(page.locator('footer').first()).toBeVisible();
    await expect.poll(() => frame.evaluate((image: HTMLImageElement) => image.currentSrc)).toMatch(/^data:image\//);
    expect(artworkRequests).toEqual([]);

    // Native picture selection must reveal the real desktop artwork even while
    // application scripts are still held; no mounted/resize state is needed.
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(frame).toBeVisible();
    await expect.poll(() => frame.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 1)).toBe(true);
    expect(await frame.evaluate((image: HTMLImageElement) => image.currentSrc)).toContain('plane-window');
    expect(artworkRequests).toHaveLength(1);
  } finally {
    release();
  }
  await page.waitForFunction(() => (window as Window & { __TF_BOOT__?: { sealed: boolean } }).__TF_BOOT__?.sealed);
});

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
  test(`cookie banner is immediately visible and replays the first ${choice.stored} click`, async ({ page }) => {
    const release = await holdApplicationScripts(page);
    await page.goto('/', { waitUntil: 'commit' });
    const button = page.getByRole('button', { name: choice.label, exact: true });
    await expect(button).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('tf_cookie_consent_choice_v1'))).toBeNull();
    await button.click();
    release();
    await expect(button).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('tf_cookie_consent_choice_v1'))).toBe(choice.stored);
    const releaseReload = await holdApplicationScripts(page);
    await page.reload({ waitUntil: 'commit' });
    await expect(page.locator('main h1').first()).toBeVisible();
    await expect(page.locator('[data-tf-consent-banner]')).toBeHidden();
    releaseReload();
    await page.waitForFunction(() => (window as Window & { __TF_BOOT__?: { sealed: boolean } }).__TF_BOOT__?.sealed);
    await expect(button).toHaveCount(0);
  });
}

test('the initial cookie banner stays in place during a navigation press', async ({ page }) => {
  const release = await holdApplicationScripts(page);
  await page.goto('/', { waitUntil: 'commit' });
  const banner = page.locator('[data-tf-consent-banner]');
  await expect(banner).toBeVisible();
  const initialBox = await banner.boundingBox();
  const cta = page.locator('header').getByRole('link', { name: 'Create Trip', exact: true }).first();
  await expect(cta).toBeVisible();
  const box = await cta.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  release();
  await page.waitForFunction(() => (window as Window & { __TF_BOOT__?: { sealed: boolean } }).__TF_BOOT__?.sealed);
  await expect(banner).toBeVisible();
  expect(await banner.boundingBox()).toEqual(initialBox);
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

for (const scenario of [
  { stored: 'dark', os: 'light', expected: 'dark' },
  { stored: 'light', os: 'dark', expected: 'light' },
  { stored: null, os: 'dark', expected: 'dark' },
  { stored: null, os: 'light', expected: 'light' },
] as const) {
  test(`theme starts and stays ${scenario.expected} with stored ${scenario.stored} and OS ${scenario.os}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scenario.os });
    await page.addInitScript(stored => {
      if (stored) localStorage.setItem('tf_theme_preference_v1', stored);
      else localStorage.removeItem('tf_theme_preference_v1');
    }, scenario.stored);
    const release = await holdApplicationScripts(page);
    await page.goto('/features', { waitUntil: 'commit' });
    await expect(page.locator('main h1')).toBeVisible();
    const dark = scenario.expected === 'dark';
    expect(await page.locator('html').evaluate(el => el.classList.contains('dark'))).toBe(dark);
    await expect(page.locator('html')).toHaveCSS('color-scheme', scenario.expected);
    const initialBackground = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
    await page.evaluate(() => {
      (window as any).__themeChanges = [];
      new MutationObserver(() => (window as any).__themeChanges.push(document.documentElement.classList.contains('dark')))
        .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    });
    release();
    await page.waitForFunction(() => (window as Window & { __TF_BOOT__?: { sealed: boolean } }).__TF_BOOT__?.sealed);
    await expect(page.getByRole('button', { name: dark ? 'Switch to light mode' : 'Switch to dark mode' })).toBeVisible();
    expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe(initialBackground);
    expect(await page.evaluate(() => (window as any).__themeChanges.every((value: boolean) => value === document.documentElement.classList.contains('dark')))).toBe(true);
    await page.locator('header').getByRole('link', { name: 'Pricing', exact: true }).first().click();
    await expect(page).toHaveURL(/\/pricing\/?$/);
    await expect(page.locator('html')).toHaveCSS('color-scheme', scenario.expected);
    await expect(page.locator('meta[data-tf-theme-color]')).toHaveAttribute('content', dark ? '#242322' : '#ffffff');
    if (!scenario.stored) {
      await page.emulateMedia({ colorScheme: dark ? 'light' : 'dark' });
      await expect(page.getByRole('button', { name: dark ? 'Switch to dark mode' : 'Switch to light mode' })).toBeVisible();
      await expect(page.locator('html')).toHaveCSS('color-scheme', dark ? 'light' : 'dark');
    }
  });
}

for (const account of [{ path: '/features', label: 'Account' }, { path: '/de/features', label: 'Konto' }]) {
  test(`${account.label} remains the same entry and opens on the first cold click`, async ({ page }) => {
    const release = await holdApplicationScripts(page);
    await page.goto(account.path, { waitUntil: 'commit' });
    const trigger = page.locator('header [data-tf-boot-replay="account-entry:header"]');
    await expect(trigger).toBeVisible();
    const box = await trigger.boundingBox();
    await trigger.click();
    release();
    await expect(page.getByRole('menu', { name: account.label, exact: true })).toBeVisible();
    await expect(trigger).toHaveText(account.label);
    expect(await trigger.boundingBox()).toEqual(box);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}

test('mobile account menu keeps keyboard focus within its navigation dialog', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/features');
  await expect(page.getByRole('button', { name: 'Essential only', exact: true })).toBeVisible();
  await page.locator('[data-tf-boot-intent="mobile-menu"]').click();
  const navigation = page.getByRole('dialog', { name: 'Navigation menu' });
  await expect(navigation).toBeVisible();
  const account = navigation.getByRole('button', { name: 'Account', exact: true });
  await account.click();
  await page.keyboard.press('ArrowDown');
  const menu = page.getByRole('menu', { name: 'Account', exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(navigation).toBeVisible();
  await expect(account).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(navigation).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Essential only', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('tf_cookie_consent_choice_v1'))).toBeNull();
});


test('features essential hero does not wait for an entrance animation or application scripts', async ({ page }) => {
  const release = await holdApplicationScripts(page);
  await page.goto('/features', { waitUntil: 'commit' });
  const heading = page.locator('main h1');
  await expect(heading).toBeVisible();
  await page.addStyleTag({ content: '* { animation-play-state: paused !important; }' });
  expect(await heading.locator('span').evaluateAll(elements => elements.every(el => getComputedStyle(el).opacity === '1'))).toBe(true);
  const cta = page.locator('main section').first().getByRole('link', { name: 'Start planning', exact: true });
  await expect(cta).toBeVisible();
  expect(await cta.evaluate(element => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      if (getComputedStyle(node).opacity !== '1') return false;
    }
    return true;
  })).toBe(true);
  release();
});

test('mobile language selection works inside the navigation focus trap without answering consent', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/features');
  await page.locator('[data-tf-boot-intent="mobile-menu"]').click();
  const navigation = page.getByRole('dialog', { name: 'Navigation menu' });
  await navigation.getByRole('combobox', { name: 'Language', exact: true }).click();
  await page.getByRole('option', { name: 'Deutsch', exact: true }).click();
  await expect(page).toHaveURL(/\/de\/features\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(navigation).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('tf_cookie_consent_choice_v1'))).toBeNull();
});

test('ordinary trip viewing and details do not require optional generation or authoring modules', async ({ page }) => {
  const optionalRequests: string[] = [];
  await page.route('**/assets/{aiService,tripGenerationRetryService,tripGenerationQueueService,destinationService,countryAliasService,TripClaimConflictDialog}-*.js', route => {
    optionalRequests.push(new URL(route.request().url()).pathname);
    return route.abort('failed');
  });
  await page.goto('/example/thailand-islands');
  await page.getByRole('button', { name: /Open trip details/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Trip meta', exact: true })).toBeVisible();
  expect(optionalRequests).toEqual([]);
});


test('claim recovery has a complete native creation link and hands focus to login and back', async ({ page }) => {
  const trip = {
    id: 'runtime-conflict-trip', title: 'Runtime Mallorca Draft', startDate: '2027-04-01',
    createdAt: 1_800_000_000_000, updatedAt: 1_800_000_000_000, items: [],
    aiMeta: { generation: { state: 'failed', inputSnapshot: {
      flow: 'wizard', destinationLabel: 'Mallorca', startDate: '2027-04-01', endDate: '2027-04-10',
      createdAt: '2027-01-01T00:00:00Z', payload: { options: { countries: ['Mallorca, Spain'], notes: 'Retain this draft' } },
    } } },
  };
  const encoded = LZString.compressToEncodedURIComponent(JSON.stringify({ trip }));
  await page.goto(`/trip/${encoded}?claim_conflict=already_claimed#details`);
  const recovery = page.getByRole('dialog', { name: 'This trip draft was already claimed', exact: true });
  await expect(recovery).toBeVisible();
  const create = recovery.getByRole('link', { name: 'Create similar trip', exact: true });
  const href = await create.getAttribute('href');
  expect(href).toMatch(/^\/create-trip\/wizard\?prefill=/);
  const encodedPrefill = new URL(href!, 'https://travelflow.local').searchParams.get('prefill');
  const prefill = JSON.parse(Buffer.from(encodedPrefill!, 'base64url').toString('utf8'));
  expect(prefill.countries).toEqual(['Mallorca']);
  expect(prefill.notes).toBe('Retain this draft');
  const login = recovery.getByRole('button', { name: 'Sign in with the original account', exact: true });
  await expect(login).toBeFocused();
  await login.click();
  const auth = page.getByRole('dialog', { name: 'Authentication modal', exact: true });
  await expect(auth).toBeVisible();
  await expect(recovery).toHaveCount(0);
  await page.keyboard.press('Tab');
  expect(await auth.evaluate(node => node.contains(document.activeElement))).toBe(true);
  await auth.getByRole('button', { name: 'Close authentication modal', exact: true }).click();
  await expect(recovery).toBeVisible();
  await expect(login).toBeFocused();
  await expect(create).toHaveAttribute('href', href!);
});

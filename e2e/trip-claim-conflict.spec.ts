import LZString from 'lz-string';
import { expect, test, type Page } from '@playwright/test';

const E2E_AUTH_SANDBOX_STORAGE_KEY = 'tf_e2e_auth_sandbox_v1';
const E2E_TRIP_CLAIM_SANDBOX_STORAGE_KEY = 'tf_e2e_trip_claim_sandbox_v1';
const AUTH_RETURN_PATH_STORAGE_KEY = 'tf_auth_return_path_v1';
const E2E_SANDBOX_INIT_FLAG = 'tf_e2e_sandbox_seeded_v1';
const CLAIM_REQUEST_ID = 'e2e-claim-request-1';

const pendingAuthTrip = {
    id: 'trip-e2e-claim-conflict',
    title: 'Mallorca Luxury Beach Nightlife',
    startDate: '2026-04-01',
    items: [],
    createdAt: 1_741_684_800_000,
    updatedAt: 1_741_684_800_000,
    aiMeta: {
        provider: 'openai',
        model: 'gpt-5.4',
        generatedAt: '2026-03-11T08:00:00.000Z',
        generation: {
            state: 'failed',
            latestAttempt: {
                id: 'attempt-e2e-claim-conflict',
                flow: 'wizard',
                source: 'create_trip_v3_pending_auth',
                state: 'failed',
                startedAt: '2026-03-11T08:00:00.000Z',
                requestId: CLAIM_REQUEST_ID,
                metadata: {
                    pendingAuth: true,
                    queueRequestId: CLAIM_REQUEST_ID,
                    queueExpiresAt: '2026-03-25T08:00:00.000Z',
                    orchestration: 'auth_queue_claim',
                },
            },
            inputSnapshot: {
                flow: 'wizard',
                destinationLabel: 'Mallorca',
                startDate: '2026-04-01',
                endDate: '2026-04-10',
                createdAt: '2026-03-11T08:00:00.000Z',
                payload: {
                    wizardBranch: 'known_destinations_flexible_dates',
                    options: {
                        countries: ['Mallorca, Spain'],
                        startDate: '2026-04-01',
                        endDate: '2026-04-10',
                        roundTrip: true,
                        budget: 'Luxury',
                        pace: 'Balanced',
                        notes: 'Beach clubs, but avoid long transfers.',
                        specificCities: 'Palma, Port de Sóller',
                        dateInputMode: 'flex',
                        flexWeeks: 2,
                        flexWindow: 'shoulder',
                        startDestination: 'Mallorca, Spain',
                        destinationOrder: ['Mallorca, Spain'],
                        routeLock: true,
                        travelerType: 'friends',
                        travelerDetails: {
                            friendsCount: 4,
                            friendsEnergy: 'mixed',
                        },
                        tripStyleTags: ['luxury', 'beach'],
                        tripVibeTags: ['nightlife'],
                        transportPreferences: ['car'],
                        hasTransportOverride: true,
                        idealMonths: ['May', 'June'],
                        shoulderMonths: ['April'],
                        recommendedDurationDays: 10,
                        selectedIslandNames: ['Mallorca, Spain'],
                        enforceIslandOnly: true,
                    },
                },
            },
        },
    },
};

const buildTripRoute = (search: string): string => {
    const encodedTrip = LZString.compressToEncodedURIComponent(JSON.stringify({ trip: pendingAuthTrip }));
    return `/trip/${encodedTrip}?${search}`;
};

const seedSandboxState = async (
    page: Page,
    options?: { claimOutcome?: 'claimed_by_another_user' | 'recovered_existing_claim' },
) => {
    await page.addInitScript(({ claimRequestId, authStorageKey, claimStorageKey, authReturnPathKey, initFlagKey, claimOutcome }) => {
        if (window.sessionStorage.getItem(initFlagKey) === '1') {
            return;
        }
        window.localStorage.removeItem(authStorageKey);
        window.localStorage.removeItem(claimStorageKey);
        window.localStorage.removeItem(authReturnPathKey);
        window.sessionStorage.clear();
        if (claimOutcome) {
            window.localStorage.setItem(claimStorageKey, JSON.stringify({
                [claimRequestId]: {
                    outcome: claimOutcome,
                },
            }));
        }
        window.sessionStorage.setItem(initFlagKey, '1');
    }, {
        claimRequestId: CLAIM_REQUEST_ID,
        authStorageKey: E2E_AUTH_SANDBOX_STORAGE_KEY,
        claimStorageKey: E2E_TRIP_CLAIM_SANDBOX_STORAGE_KEY,
        authReturnPathKey: AUTH_RETURN_PATH_STORAGE_KEY,
        initFlagKey: E2E_SANDBOX_INIT_FLAG,
        claimOutcome: options?.claimOutcome ?? null,
    });
};

test('logged-out claim-conflict modal shows login and create-similar actions', async ({ page }) => {
    await seedSandboxState(page);
    await page.goto(buildTripRoute('claim_conflict=already_claimed'));

    await expect(page.getByRole('heading', { name: 'This trip draft was already claimed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with the original account' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create similar trip' })).toBeVisible();
});

test('guest registration hits the claim-conflict modal and preserves create-similar prefill', async ({ page }) => {
    await seedSandboxState(page, { claimOutcome: 'claimed_by_another_user' });
    await page.goto(buildTripRoute(`claim=${CLAIM_REQUEST_ID}`));

    await expect(page.getByText('Creating trips is only for registered users')).toBeVisible();
    await page.getByRole('button', { name: 'Sign in or create account' }).click();

    const authDialog = page.getByRole('dialog', { name: 'Authentication modal' });
    await expect(authDialog).toBeVisible();
    await authDialog.getByRole('button', { name: 'Create account' }).first().click();
    await authDialog.getByLabel('Email').fill('e2e-claim-conflict@example.com');
    await authDialog.getByLabel('Password').fill('password123');
    await authDialog.getByRole('checkbox').check();
    await authDialog.locator('form').getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/claim_conflict=already_claimed/);
    await expect(page.getByRole('heading', { name: 'This trip draft was already claimed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in with the original account' })).toHaveCount(0);

    const createSimilarLink = page.getByRole('link', { name: 'Create similar trip' });
    const createSimilarHref = await createSimilarLink.getAttribute('href');
    expect(createSimilarHref).toMatch(/\/create-trip\/wizard\?prefill=/);

    await page.goto(createSimilarHref!);
    await expect(page).toHaveURL(/\/create-trip\/wizard\?prefill=/);

    const decodedPrefill = await page.evaluate(async () => {
        const encoded = new URLSearchParams(window.location.search).get('prefill');
        if (!encoded) return null;
        const { decodeTripPrefill } = await import('/services/tripPrefillDecoder.ts');
        return decodeTripPrefill(encoded);
    });

    expect(decodedPrefill).toMatchObject({
        countries: ['Mallorca'],
        mode: 'wizard',
        cities: 'Palma, Port de Sóller',
        styles: ['luxury', 'beach'],
        vibes: ['nightlife'],
        meta: {
            draft: {
                version: 2,
                wizardBranch: 'known_destinations_flexible_dates',
                travelerType: 'friends',
                transportPreferences: ['car'],
                specificCities: 'Palma, Port de Sóller',
                selectedIslandNames: ['Mallorca'],
                enforceIslandOnly: true,
            },
        },
    });
});

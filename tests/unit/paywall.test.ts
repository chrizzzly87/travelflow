import { describe, expect, it } from 'vitest';
import {
    buildDirectReactivatedTrip,
    buildPaywalledTripDisplay,
    getTripLifecycleState,
    resolveTripPaywallActivationMode,
    shouldShowTripPaywall,
} from '../../config/paywall';
import { buildTripExpiryIso } from '../../config/productLimits';
import { makeActivityItem, makeCityItem, makeTrip, makeTravelItem } from '../helpers/tripFixtures';

describe('config/paywall', () => {
  it('resolves lifecycle states from status and expiration', () => {
    const archived = makeTrip({ status: 'archived' });
    expect(getTripLifecycleState(archived)).toBe('archived');

    const expired = makeTrip({ status: 'expired' });
    expect(getTripLifecycleState(expired)).toBe('expired');

    const active = makeTrip({ status: 'active' });
    expect(getTripLifecycleState(active, { nowMs: Date.parse('2026-01-10T00:00:00Z') })).toBe('active');

    const expiring = makeTrip({
      status: 'active',
      tripExpiresAt: '2026-01-05T00:00:00Z',
    });
    expect(getTripLifecycleState(expiring, { nowMs: Date.parse('2026-01-05T00:00:00Z') })).toBe('expired');
    expect(getTripLifecycleState(expiring, { expiredOverride: false })).toBe('active');
  });

  it('shows paywall only for expired non-example trips', () => {
    const expired = makeTrip({ status: 'expired' });
    expect(shouldShowTripPaywall(expired)).toBe(true);

    const example = makeTrip({ status: 'expired', isExample: true });
    expect(shouldShowTripPaywall(example)).toBe(false);

    const active = makeTrip({ status: 'active' });
    expect(shouldShowTripPaywall(active)).toBe(false);
  });

  it('resolves paywall activation mode from auth and route context', () => {
    expect(resolveTripPaywallActivationMode({
      isAuthenticated: false,
      isAnonymous: false,
      isTripDetailRoute: true,
    })).toBe('login_modal');

    expect(resolveTripPaywallActivationMode({
      isAuthenticated: true,
      isAnonymous: true,
      isTripDetailRoute: true,
    })).toBe('login_modal');

    expect(resolveTripPaywallActivationMode({
      isAuthenticated: true,
      isAnonymous: false,
      isTripDetailRoute: false,
    })).toBe('login_modal');

    expect(resolveTripPaywallActivationMode({
      isAuthenticated: true,
      isAnonymous: false,
      isTripDetailRoute: true,
    })).toBe('direct_reactivate');
  });

  it('builds a direct reactivation payload with refreshed expiry', () => {
    const sourceTrip = makeTrip({
      status: 'expired',
      tripExpiresAt: '2026-02-01T00:00:00.000Z',
      updatedAt: Date.parse('2026-02-01T00:00:00.000Z'),
    });
    const nowMs = Date.parse('2026-03-01T12:00:00.000Z');
    const reactivated = buildDirectReactivatedTrip({
      trip: sourceTrip,
      nowMs,
      tripExpirationDays: 30,
    });

    expect(reactivated.status).toBe('active');
    expect(reactivated.updatedAt).toBe(nowMs);
    expect(reactivated.tripExpiresAt).toBe(buildTripExpiryIso(nowMs, 30));
  });

  it('builds deterministic paywalled trip masking', () => {
    const cityA = makeCityItem({ id: 'city-a', title: 'Berlin', startDateOffset: 0, duration: 2, location: 'Berlin, Germany' });
    const cityB = makeCityItem({ id: 'city-b', title: 'Prague', startDateOffset: 2.2, duration: 2, location: 'Prague, Czechia' });
    const travel = {
      ...makeTravelItem('travel-a', 2, 'Train to Prague'),
      location: 'Berlin to Prague',
    };
    const activity = makeActivityItem('act-a', 'Berlin, Germany', 0.4);

    const sourceTrip = makeTrip({
      items: [cityA, travel, cityB, activity],
      countryInfo: {
        bestMonthsToVisit: '',
        bestMonthsArray: [],
        weatherSummary: '',
        estimatedBudget: '',
        visaRequirement: '',
      },
    });

    const masked = buildPaywalledTripDisplay(sourceTrip);
    const maskedCities = masked.items.filter((item) => item.type === 'city');

    expect(masked.countryInfo).toBeUndefined();
    expect(maskedCities[0].title).toBe('First destination');
    expect(maskedCities[1].title).toBe('Second destination');
    expect(maskedCities[0].location).toBe('First destination');
    expect(maskedCities[1].location).toBe('Second destination');

    const maskedActivity = masked.items.find((item) => item.id === 'act-a');
    expect(maskedActivity?.location).toBe('Location hidden');

    const maskedTravel = masked.items.find((item) => item.id === 'travel-a');
    expect(maskedTravel?.location).toBe('Location hidden');
  });

  it('creates ordinal fallback labels beyond predefined list', () => {
    const manyCities = Array.from({ length: 13 }, (_, index) =>
      makeCityItem({
        id: `city-${index + 1}`,
        title: `City ${index + 1}`,
        startDateOffset: index,
        duration: 1,
        location: `City ${index + 1}`,
      })
    );
    const masked = buildPaywalledTripDisplay(makeTrip({ items: manyCities }));
    const thirteenth = masked.items.find((item) => item.id === 'city-13');
    expect(thirteenth?.title).toBe('13th destination');
  });
});

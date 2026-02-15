import type { Entitlements, PlanTierKey } from '../types';

export interface PlanCatalogEntry {
    key: PlanTierKey;
    publicName: 'Backpacker' | 'Explorer' | 'Globetrotter';
    publicSlug: 'backpacker' | 'explorer' | 'globetrotter';
    monthlyPriceUsd: number;
    sortOrder: number;
    entitlements: Entitlements;
}

export const PLAN_CATALOG: Record<PlanTierKey, PlanCatalogEntry> = {
    tier_free: {
        key: 'tier_free',
        publicName: 'Backpacker',
        publicSlug: 'backpacker',
        monthlyPriceUsd: 0,
        sortOrder: 10,
        entitlements: {
            maxActiveTrips: 5,
            maxTotalTrips: 50,
            tripExpirationDays: 14,
            canShare: true,
            canCreateEditableShares: false,
            canViewProTrips: true,
            canCreateProTrips: false,
        },
    },
    tier_mid: {
        key: 'tier_mid',
        publicName: 'Explorer',
        publicSlug: 'explorer',
        monthlyPriceUsd: 9,
        sortOrder: 20,
        entitlements: {
            maxActiveTrips: 30,
            maxTotalTrips: 500,
            tripExpirationDays: 90,
            canShare: true,
            canCreateEditableShares: true,
            canViewProTrips: true,
            canCreateProTrips: true,
        },
    },
    tier_premium: {
        key: 'tier_premium',
        publicName: 'Globetrotter',
        publicSlug: 'globetrotter',
        monthlyPriceUsd: 19,
        sortOrder: 30,
        entitlements: {
            maxActiveTrips: null,
            maxTotalTrips: null,
            tripExpirationDays: null,
            canShare: true,
            canCreateEditableShares: true,
            canViewProTrips: true,
            canCreateProTrips: true,
        },
    },
};

export const PLAN_ORDER: PlanTierKey[] = ['tier_free', 'tier_mid', 'tier_premium'];

export const resolvePlanEntry = (key: PlanTierKey): PlanCatalogEntry => PLAN_CATALOG[key];

export const getFreePlanEntitlements = (): Entitlements => PLAN_CATALOG.tier_free.entitlements;

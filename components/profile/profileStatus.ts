import type { PlanTierKey } from '../../types';

export interface ProfileStatus {
  key: 'backpacker' | 'explorer' | 'globetrotter';
  label: string;
  orbitLabel: string;
  ringClassName: string;
}

const STATUS_BY_TIER: Record<PlanTierKey, ProfileStatus> = {
  tier_free: {
    key: 'backpacker',
    label: 'Backpacker',
    orbitLabel: 'Backpacker',
    ringClassName: 'text-amber-700',
  },
  tier_mid: {
    key: 'explorer',
    label: 'Explorer',
    orbitLabel: 'Explorer',
    ringClassName: 'text-sky-700',
  },
  tier_premium: {
    key: 'globetrotter',
    label: 'Globetrotter',
    orbitLabel: 'Globetrotter',
    ringClassName: 'text-emerald-700',
  },
};

export const resolveProfileStatusByTier = (tierKey: PlanTierKey | null | undefined): ProfileStatus => {
  if (!tierKey) return STATUS_BY_TIER.tier_free;
  return STATUS_BY_TIER[tierKey] ?? STATUS_BY_TIER.tier_free;
};

export const resolveProfileStatusByTripCount = (tripCount: number): ProfileStatus => {
  if (tripCount >= 30) return STATUS_BY_TIER.tier_premium;
  if (tripCount >= 10) return STATUS_BY_TIER.tier_mid;
  return STATUS_BY_TIER.tier_free;
};

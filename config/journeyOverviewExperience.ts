export type TripJourneyOverviewRollout = 'off' | 'tripview';

const VALID_ROLLOUTS = new Set<TripJourneyOverviewRollout>(['off', 'tripview']);

export const resolveTripJourneyOverviewRollout = (value: unknown): TripJourneyOverviewRollout => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return VALID_ROLLOUTS.has(normalized as TripJourneyOverviewRollout)
    ? normalized as TripJourneyOverviewRollout
    : 'off';
};

export const getTripJourneyOverviewRollout = (): TripJourneyOverviewRollout => (
  resolveTripJourneyOverviewRollout(import.meta.env.VITE_TRIP_JOURNEY_OVERVIEW_ROLLOUT)
);

export const shouldRenderTripJourneyOverview = ({
  rollout = getTripJourneyOverviewRollout(),
  hasCity,
  isPaywallLocked,
}: {
  rollout?: TripJourneyOverviewRollout;
  hasCity: boolean;
  isPaywallLocked: boolean;
}): boolean => rollout === 'tripview' && hasCity && !isPaywallLocked;

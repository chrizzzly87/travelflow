export type CreateTripShapeRollout = 'off' | 'wizard' | 'primary';
export type CreateTripSurface = 'primary' | 'wizard';
export type CreateTripExperience = 'classic' | 'wizard_v3' | 'shape_thailand';

const VALID_ROLLOUTS = new Set<CreateTripShapeRollout>(['off', 'wizard', 'primary']);

export const resolveCreateTripShapeRollout = (value: unknown): CreateTripShapeRollout => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return VALID_ROLLOUTS.has(normalized as CreateTripShapeRollout)
    ? normalized as CreateTripShapeRollout
    : 'off';
};

export const getCreateTripShapeRollout = (): CreateTripShapeRollout =>
  resolveCreateTripShapeRollout(import.meta.env.VITE_CREATE_TRIP_SHAPE_ROLLOUT);

export const resolveCreateTripExperience = (
  surface: CreateTripSurface,
  rollout: CreateTripShapeRollout = getCreateTripShapeRollout(),
): CreateTripExperience => {
  if (rollout === 'primary' || (rollout === 'wizard' && surface === 'wizard')) {
    return 'shape_thailand';
  }
  return surface === 'wizard' ? 'wizard_v3' : 'classic';
};

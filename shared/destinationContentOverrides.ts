export type DestinationOverrideTargetKind = 'guide' | 'country_profile';
export type DestinationOverrideStatus = 'draft' | 'published';

export interface DestinationContentOverride {
  id: string;
  targetKind: DestinationOverrideTargetKind;
  targetId: string;
  status: DestinationOverrideStatus;
  patch: Record<string, unknown>;
  note: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

const GUIDE_PATCH_KEYS = new Set([
  'name', 'region', 'priorityRank', 'tags', 'summary', 'suggestedTripDays', 'seasonality',
  'facts', 'airports', 'beaches', 'highlights', 'events', 'sourceLinks', 'sourceUpdatedAt', 'reviewedAt',
]);
const PROFILE_PATCH_KEYS = new Set([
  'currencyCode', 'timezone', 'callingCode', 'popularity', 'summary', 'alertMessage', 'safetyTips',
  'bonusTips', 'sections', 'faqs', 'recentUpdates', 'airports', 'beaches', 'cities', 'weather', 'exchange',
]);

export const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

export const deepMergeDestinationContent = <T>(base: T, patch: Record<string, unknown>): T => {
  if (!isPlainObject(base)) return patch as T;
  const merged: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  Object.entries(patch).forEach(([key, value]) => {
    merged[key] = isPlainObject(value) && isPlainObject(merged[key])
      ? deepMergeDestinationContent(merged[key], value)
      : value;
  });
  return merged as T;
};

export const validateDestinationOverridePatch = (
  targetKind: DestinationOverrideTargetKind,
  value: unknown,
): { ok: true; patch: Record<string, unknown> } | { ok: false; error: string } => {
  if (!isPlainObject(value)) return { ok: false, error: 'Override patch must be a JSON object.' };
  const serialized = JSON.stringify(value);
  if (serialized.length > 500_000) return { ok: false, error: 'Override patch is too large.' };
  const allowed = targetKind === 'guide' ? GUIDE_PATCH_KEYS : PROFILE_PATCH_KEYS;
  const unknownKeys = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknownKeys.length > 0) {
    return { ok: false, error: `Unsupported override fields: ${unknownKeys.join(', ')}.` };
  }
  return { ok: true, patch: value };
};

export const mapDestinationOverrideRow = (value: unknown): DestinationContentOverride | null => {
  if (!isPlainObject(value) || !isPlainObject(value.patch)) return null;
  if (value.target_kind !== 'guide' && value.target_kind !== 'country_profile') return null;
  if (value.status !== 'draft' && value.status !== 'published') return null;
  if (typeof value.id !== 'string' || typeof value.target_id !== 'string' || typeof value.updated_at !== 'string') return null;
  return {
    id: value.id,
    targetKind: value.target_kind,
    targetId: value.target_id,
    status: value.status,
    patch: value.patch,
    note: typeof value.note === 'string' ? value.note : null,
    updatedAt: value.updated_at,
    updatedBy: typeof value.updated_by === 'string' ? value.updated_by : null,
  };
};

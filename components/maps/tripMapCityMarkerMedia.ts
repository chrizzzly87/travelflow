import type { ITimelineItem } from '../../types';

export const resolveTripMapCityMarkerImageUrl = (
  city: Pick<ITimelineItem, 'imageUrl'>,
): string | null => {
  if (typeof city.imageUrl !== 'string') return null;
  const normalized = city.imageUrl.trim();
  return normalized.length > 0 ? normalized : null;
};

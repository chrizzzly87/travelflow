// Structural types only: this module is also imported by edge functions, which
// cannot resolve the app's `../types` module.
type ActivityKind = 'activity' | 'day-trip';

interface StayWindow {
    startDateOffset: number;
    duration: number;
}

interface StayLike extends StayWindow {
    id: string;
}

interface PlacedActivity {
    startDateOffset: number;
    stayCityId?: string;
}

const OFFSET_EPSILON = 0.00001;

export const isDayTrip = (item: { type?: string; activityKind?: string } | null | undefined): boolean => (
    Boolean(item) && item!.type === 'activity' && item!.activityKind === 'day-trip'
);

export const resolveActivityKind = (item: { activityKind?: string }): ActivityKind => (
    item.activityKind === 'day-trip' ? 'day-trip' : 'activity'
);

/**
 * The stay whose date window contains `offset`, then the stay under way before
 * it, then the first stay. Anything that falls into a gap still has an owner.
 */
export const resolveStayForOffset = <T extends StayLike>(
    offset: number,
    cities: T[],
): T | null => {
    const direct = cities.find((city) => (
        offset >= city.startDateOffset - OFFSET_EPSILON
        && offset < city.startDateOffset + Math.max(city.duration, 0) - OFFSET_EPSILON
    ));
    if (direct) return direct;

    const previous = [...cities]
        .sort((a, b) => a.startDateOffset - b.startDateOffset)
        .reverse()
        .find((city) => city.startDateOffset <= offset);
    if (previous) return previous;
    return cities[0] || null;
};

/**
 * Whether an activity starting at `offset` can still belong to `stay`: any day
 * of the stay, including the departure day it shares with the next stay.
 */
const isOffsetWithinStayReach = (offset: number, stay: StayWindow): boolean => (
    offset >= Math.floor(stay.startDateOffset + OFFSET_EPSILON) - OFFSET_EPSILON
    && offset < stay.startDateOffset + Math.max(stay.duration, 0) + 1 - OFFSET_EPSILON
);

/**
 * Which stay an activity belongs to. An explicit `stayCityId` wins while that
 * stay still exists and the activity still falls on one of its days; once the
 * activity has been dragged elsewhere — or on older trips without an id — the
 * date window it starts in decides.
 */
export const resolveExplicitActivityStay = <T extends StayLike>(
    activity: PlacedActivity,
    cities: T[],
): T | null => {
    if (!activity.stayCityId) return null;
    const explicit = cities.find((city) => city.id === activity.stayCityId);
    return explicit && isOffsetWithinStayReach(activity.startDateOffset, explicit) ? explicit : null;
};

export const resolveActivityStay = <T extends StayLike>(
    activity: PlacedActivity,
    cities: T[],
): T | null => (
    resolveExplicitActivityStay(activity, cities) ?? resolveStayForOffset(activity.startDateOffset, cities)
);

/** Where a day trip ends: its own stay unless the traveller picked another one. */
export const resolveDayTripReturnStay = <T extends StayLike>(
    activity: PlacedActivity & { dayTripReturnCityId?: string },
    cities: T[],
): T | null => {
    if (activity.dayTripReturnCityId) {
        const explicit = cities.find((city) => city.id === activity.dayTripReturnCityId);
        if (explicit) return explicit;
    }
    return resolveActivityStay(activity, cities);
};

/** Day offsets (whole days, trip-relative) a stay covers — at least one. */
export const listStayDayOffsets = (stay: StayWindow): number[] => {
    const first = Math.floor(stay.startDateOffset + OFFSET_EPSILON);
    const last = Math.max(first, Math.ceil(stay.startDateOffset + Math.max(stay.duration, 0) - OFFSET_EPSILON) - 1);
    const days: number[] = [];
    for (let day = first; day <= last; day += 1) days.push(day);
    return days;
};

/** Keep an activity's day inside its stay when the stay changes. */
export const clampDayOffsetToStay = (
    dayOffset: number,
    stay: StayWindow,
): number => {
    const days = listStayDayOffsets(stay);
    const whole = Math.floor(dayOffset + OFFSET_EPSILON);
    if (whole < days[0]) return days[0];
    if (whole > days[days.length - 1]) return days[days.length - 1];
    return whole;
};

/**
 * Where a new activity starts when it is added from the lane's single "+":
 * the first day of the selected stay (or of the selected activity's stay),
 * otherwise the first day of the trip.
 */
export const resolveDefaultActivityDayOffset = <T extends StayLike & { type: string }>({
    items,
    selectedItemId,
    selectedCityIds = [],
}: {
    items: T[];
    selectedItemId?: string | null;
    selectedCityIds?: string[];
}): number => {
    const cities = items.filter((item) => item.type === 'city');
    const selected = selectedItemId ? items.find((item) => item.id === selectedItemId) : undefined;
    let stay: T | null | undefined;
    if (selected?.type === 'city') stay = selected;
    else if (selected?.type === 'activity') stay = resolveActivityStay(selected, cities);
    if (!stay && selectedCityIds.length > 0) stay = cities.find((city) => city.id === selectedCityIds[0]);
    if (!stay) return 0;
    // The stay's exact start, not the whole day it falls on: a stay that begins
    // on an afternoon arrival shares that day with the stay before it, and the
    // floored day would resolve to the wrong one. Consumers floor for display.
    return Math.max(0, stay.startDateOffset);
};

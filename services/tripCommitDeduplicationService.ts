import type { ITrip, IViewSettings } from '../types';

export interface TripCommitDeduplicationState {
    inFlightFingerprints: Set<string>;
    lastCommittedFingerprint: string | null;
}

interface TripCommitFingerprintInput {
    trip: ITrip;
    view: IViewSettings | undefined;
    label: string | null | undefined;
    adminOverride?: boolean;
}

type SerializableValue =
    | null
    | boolean
    | number
    | string
    | SerializableValue[]
    | { [key: string]: SerializableValue };

const stableSerialize = (value: unknown): SerializableValue => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (Array.isArray(value)) {
        return value.map((entry) => stableSerialize(entry));
    }
    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return Object.keys(record)
            .sort((left, right) => left.localeCompare(right))
            .reduce<Record<string, SerializableValue>>((next, key) => {
                next[key] = stableSerialize(record[key]);
                return next;
            }, {});
    }
    return String(value);
};

const normalizeTripForFingerprint = (trip: ITrip): Record<string, SerializableValue> => ({
    ...stableSerialize(trip) as Record<string, SerializableValue>,
    updatedAt: null,
});

const normalizeViewForFingerprint = (
    view: IViewSettings | undefined,
): Record<string, SerializableValue> | null => {
    if (!view) return null;
    return stableSerialize({
        ...view,
        zoomLevel: Number(view.zoomLevel.toFixed(2)),
        sidebarWidth: Math.round(view.sidebarWidth),
        timelineHeight: Math.round(view.timelineHeight),
    }) as Record<string, SerializableValue>;
};

export const createTripCommitDeduplicationState = (): TripCommitDeduplicationState => ({
    inFlightFingerprints: new Set<string>(),
    lastCommittedFingerprint: null,
});

export const resetTripCommitDeduplicationState = (state: TripCommitDeduplicationState): void => {
    state.inFlightFingerprints.clear();
    state.lastCommittedFingerprint = null;
};

export const buildTripCommitFingerprint = ({
    trip,
    view,
    label,
    adminOverride = false,
}: TripCommitFingerprintInput): string => JSON.stringify(stableSerialize({
    adminOverride,
    label: typeof label === 'string' ? label.trim() : '',
    trip: normalizeTripForFingerprint(trip),
    view: normalizeViewForFingerprint(view),
}));

export const shouldSkipTripCommitFingerprint = (
    state: TripCommitDeduplicationState,
    fingerprint: string,
): boolean => (
    state.lastCommittedFingerprint === fingerprint
    || state.inFlightFingerprints.has(fingerprint)
);

export const markTripCommitFingerprintStarted = (
    state: TripCommitDeduplicationState,
    fingerprint: string,
): void => {
    state.inFlightFingerprints.add(fingerprint);
};

export const markTripCommitFingerprintCompleted = (
    state: TripCommitDeduplicationState,
    fingerprint: string,
): void => {
    state.inFlightFingerprints.delete(fingerprint);
    state.lastCommittedFingerprint = fingerprint;
};

export const markTripCommitFingerprintFailed = (
    state: TripCommitDeduplicationState,
    fingerprint: string,
): void => {
    state.inFlightFingerprints.delete(fingerprint);
};

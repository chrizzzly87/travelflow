import type { ICoordinates, TransportMode } from '../types';
import { normalizeTransportMode } from './transportModes';

export type DistanceUnit = 'km' | 'mi';
export const DEFAULT_DISTANCE_UNIT: DistanceUnit = 'km';
const KM_PER_MILE = 1.60934;

export const convertDistance = (distanceKm: number, unit: DistanceUnit): number => {
    return unit === 'mi' ? distanceKm / KM_PER_MILE : distanceKm;
};

export const formatDistance = (
    distanceKm: number | null | undefined,
    unit: DistanceUnit = DEFAULT_DISTANCE_UNIT,
    options: { maximumFractionDigits?: number; minimumFractionDigits?: number } = {}
): string | null => {
    if (!Number.isFinite(distanceKm)) return null;
    const value = convertDistance(distanceKm as number, unit);
    const { maximumFractionDigits = value >= 10 ? 0 : 1, minimumFractionDigits = 0 } = options;
    const formatted = value.toLocaleString(undefined, { maximumFractionDigits, minimumFractionDigits });
    return `${formatted} ${unit}`;
};

export const getDistanceKm = (from: ICoordinates, to: ICoordinates): number => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(to.lat - from.lat);
    const dLng = toRad(to.lng - from.lng);
    const lat1 = toRad(from.lat);
    const lat2 = toRad(to.lat);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const earthRadiusKm = 6371;
    return earthRadiusKm * c;
};

const TRAVEL_SPEEDS_KMPH: Record<TransportMode, number> = {
    walk: 4.5,
    bicycle: 16,
    motorcycle: 60,
    car: 80,
    bus: 60,
    train: 120,
    boat: 35,
    plane: 750,
    na: 0,
};

const TRAVEL_OVERHEAD_HOURS: Partial<Record<TransportMode, number>> = {
    plane: 2,
    train: 0.5,
    bus: 0.3,
    boat: 0.5,
    car: 0.2,
    motorcycle: 0.2,
};

export const estimateTravelHours = (distanceKm: number, mode?: TransportMode | string): number | null => {
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;
    const normalizedMode = normalizeTransportMode(mode);
    if (normalizedMode === 'na') return null;
    const speed = TRAVEL_SPEEDS_KMPH[normalizedMode];
    if (!speed) return null;
    const base = distanceKm / speed;
    const overhead = TRAVEL_OVERHEAD_HOURS[normalizedMode] ?? 0;
    return Math.max(0.1, base + overhead);
};

export const formatDurationHours = (hours: number | null | undefined): string | null => {
    if (!Number.isFinite(hours)) return null;
    const totalMinutes = Math.max(1, Math.round((hours as number) * 60));
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h <= 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

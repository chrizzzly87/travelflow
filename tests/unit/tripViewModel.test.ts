import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ITimelineItem } from '../../types';
import {
    DEFAULT_DETAILS_WIDTH,
    HARD_MIN_DETAILS_WIDTH,
    MAX_ZOOM_LEVEL,
    MIN_DETAILS_WIDTH,
    MIN_ZOOM_LEVEL,
    TIMELINE_ZOOM_LEVEL_PRESETS,
    TRIP_CALENDAR_EXPORT_EVENT_BY_SCOPE,
    buildTripMetaSummary,
    extractTripTravelerWarnings,
    formatTripDateValue,
    isPlainLeftClick,
    normalizeNegativeOffsetsForTrip,
    parseTripStartDate,
    runWithOptionalViewTransition,
} from '../../components/tripview/tripViewModel';
import { makeActivityItem, makeCityItem, makeTrip } from '../helpers/tripFixtures';

const withDescription = (item: ITimelineItem, description: string): ITimelineItem => ({ ...item, description });

describe('components/tripview/tripViewModel', () => {
    describe('layout constants', () => {
        it('keeps the zoom presets inside the zoom bounds and in ascending order', () => {
            expect(TIMELINE_ZOOM_LEVEL_PRESETS[0]).toBe(MIN_ZOOM_LEVEL);
            expect(TIMELINE_ZOOM_LEVEL_PRESETS[TIMELINE_ZOOM_LEVEL_PRESETS.length - 1]).toBe(MAX_ZOOM_LEVEL);
            expect([...TIMELINE_ZOOM_LEVEL_PRESETS].sort((a, b) => a - b)).toEqual(TIMELINE_ZOOM_LEVEL_PRESETS);
        });

        it('keeps the details width default between its minimums', () => {
            expect(HARD_MIN_DETAILS_WIDTH).toBeLessThanOrEqual(MIN_DETAILS_WIDTH);
            expect(DEFAULT_DETAILS_WIDTH).toBeGreaterThanOrEqual(MIN_DETAILS_WIDTH);
        });

        it('maps every calendar export scope to its analytics event', () => {
            expect(TRIP_CALENDAR_EXPORT_EVENT_BY_SCOPE).toEqual({
                activity: 'trip_view__calendar_export--activity',
                activities: 'trip_view__calendar_export--activities',
                cities: 'trip_view__calendar_export--cities',
                all: 'trip_view__calendar_export--all',
            });
        });
    });

    describe('parseTripStartDate / formatTripDateValue', () => {
        it('parses a YYYY-MM-DD value as a local date and formats it back', () => {
            const parsed = parseTripStartDate('2026-03-09');
            expect(parsed.getFullYear()).toBe(2026);
            expect(parsed.getMonth()).toBe(2);
            expect(parsed.getDate()).toBe(9);
            expect(formatTripDateValue(parsed)).toBe('2026-03-09');
        });

        it('falls back to today for empty or invalid values', () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 10, 1, 12));
            expect(formatTripDateValue(parseTripStartDate(''))).toBe('2026-11-01');
            expect(formatTripDateValue(parseTripStartDate('not-a-date'))).toBe('2026-11-01');
            vi.useRealTimers();
        });
    });

    describe('normalizeNegativeOffsetsForTrip', () => {
        it('returns the same items when no offset is negative', () => {
            const items = [makeCityItem({ id: 'a', title: 'A', startDateOffset: 0, duration: 2 })];
            const result = normalizeNegativeOffsetsForTrip(items, '2026-05-01');
            expect(result.items).toBe(items);
            expect(result).toMatchObject({ startDate: '2026-05-01', shiftedDays: 0 });
        });

        it('ignores tiny negative drift within the epsilon', () => {
            const items = [makeCityItem({ id: 'a', title: 'A', startDateOffset: -0.0005, duration: 2 })];
            expect(normalizeNegativeOffsetsForTrip(items, '2026-05-01').shiftedDays).toBe(0);
        });

        it('shifts items forward by whole days and moves the start date back', () => {
            const items = [
                makeCityItem({ id: 'a', title: 'A', startDateOffset: -1.5, duration: 2 }),
                makeActivityItem('b', 'A', 0.25),
            ];
            const result = normalizeNegativeOffsetsForTrip(items, '2026-05-01');
            expect(result.shiftedDays).toBe(2);
            expect(result.startDate).toBe('2026-04-29');
            expect(result.items.map((item) => item.startDateOffset)).toEqual([0.5, 2.25]);
            expect(items[0].startDateOffset).toBe(-1.5);
        });

        it('crosses month boundaries when moving the start date back', () => {
            const items = [makeCityItem({ id: 'a', title: 'A', startDateOffset: -3, duration: 1 })];
            expect(normalizeNegativeOffsetsForTrip(items, '2026-03-01').startDate).toBe('2026-02-26');
        });

        it('leaves items with non-finite offsets untouched', () => {
            const broken = { ...makeActivityItem('b', 'A', 0), startDateOffset: Number.NaN };
            const items = [makeCityItem({ id: 'a', title: 'A', startDateOffset: -1, duration: 1 }), broken];
            const result = normalizeNegativeOffsetsForTrip(items, '2026-05-01');
            expect(result.items[0].startDateOffset).toBe(0);
            expect(result.items[1]).toBe(broken);
        });
    });

    describe('extractTripTravelerWarnings', () => {
        it('collects Heads Up notes from city descriptions only', () => {
            const items = [
                withDescription(
                    makeCityItem({ id: 'a', title: 'Lisbon', startDateOffset: 0, duration: 2 }),
                    '### Overview\nNice city\n### Heads Up\n- [ ] Pickpockets on tram 28\n- [x] Carry cash\n### Food\nPastel de nata',
                ),
                withDescription(makeActivityItem('b', 'Lisbon', 0.5), '### Heads Up\n- Activity note'),
                withDescription(makeCityItem({ id: 'c', title: 'Porto', startDateOffset: 2, duration: 2 }), 'No warnings here'),
            ];
            expect(extractTripTravelerWarnings(items)).toEqual([
                { cityName: 'Lisbon', notes: ['Pickpockets on tram 28', 'Carry cash'] },
            ]);
        });

        it('reads a Heads Up section at the end of the description and skips empty ones', () => {
            const items = [
                withDescription(makeCityItem({ id: 'a', title: '', location: 'Faro', startDateOffset: 0, duration: 1 }), '### Heads Up\n-- Strong sun'),
                withDescription(makeCityItem({ id: 'b', title: 'Evora', startDateOffset: 1, duration: 1 }), '### Overview\nText\n### Heads Up\n'),
            ];
            expect(extractTripTravelerWarnings(items)).toEqual([
                { cityName: 'Faro', notes: ['Strong sun'] },
            ]);
        });
        it('does not take the next section as warnings when the Heads Up section is empty', () => {
            // Regression: an empty Heads Up section followed straight by another
            // heading used to report that heading and its lines as warnings.
            const items = [
                withDescription(
                    makeCityItem({ id: 'a', title: 'Evora', startDateOffset: 0, duration: 1 }),
                    '### Heads Up\n\n### Next\nText',
                ),
                withDescription(
                    makeCityItem({ id: 'b', title: 'Sintra', startDateOffset: 1, duration: 1 }),
                    '### Heads Up\n### Food\n- Travesseiros',
                ),
            ];
            expect(extractTripTravelerWarnings(items)).toEqual([]);
        });

        it('still stops a filled Heads Up section at the next heading', () => {
            const items = [
                withDescription(
                    makeCityItem({ id: 'a', title: 'Evora', startDateOffset: 0, duration: 1 }),
                    '### Heads Up\n\n- Closed on Mondays\n\n### Next\nText',
                ),
            ];
            expect(extractTripTravelerWarnings(items)).toEqual([
                { cityName: 'Evora', notes: ['Closed on Mondays'] },
            ]);
        });
    });

    describe('buildTripMetaSummary', () => {
        it('counts cities and builds the summary line', () => {
            const trip = makeTrip({
                startDate: '2026-05-01',
                items: [
                    makeCityItem({ id: 'b', title: 'Porto', startDateOffset: 3, duration: 2 }),
                    makeCityItem({ id: 'a', title: 'Lisbon', startDateOffset: 0, duration: 3 }),
                    makeActivityItem('x', 'Lisbon', 1),
                ],
            });
            const summary = buildTripMetaSummary(trip);
            expect(summary.cityCount).toBe(2);
            expect(summary.days).toBeGreaterThan(0);
            expect(summary.summaryLine).toContain('2 cities');
            expect(summary.summaryLine.startsWith(summary.dateRange)).toBe(true);
        });

        it('uses the singular label for one city', () => {
            const trip = makeTrip({ items: [makeCityItem({ id: 'a', title: 'Lisbon', startDateOffset: 0, duration: 1 })] });
            expect(buildTripMetaSummary(trip).summaryLine).toContain('1 city');
        });
    });

    describe('isPlainLeftClick', () => {
        const click = (overrides: Partial<Record<'button' | 'metaKey' | 'altKey' | 'ctrlKey' | 'shiftKey' | 'defaultPrevented', unknown>> = {}) => ({
            defaultPrevented: false,
            button: 0,
            metaKey: false,
            altKey: false,
            ctrlKey: false,
            shiftKey: false,
            ...overrides,
        }) as unknown as Parameters<typeof isPlainLeftClick>[0];

        it('accepts a plain primary click', () => {
            expect(isPlainLeftClick(click())).toBe(true);
        });

        it('rejects modified, secondary or already handled clicks', () => {
            expect(isPlainLeftClick(click({ metaKey: true }))).toBe(false);
            expect(isPlainLeftClick(click({ ctrlKey: true }))).toBe(false);
            expect(isPlainLeftClick(click({ shiftKey: true }))).toBe(false);
            expect(isPlainLeftClick(click({ altKey: true }))).toBe(false);
            expect(isPlainLeftClick(click({ button: 1 }))).toBe(false);
            expect(isPlainLeftClick(click({ defaultPrevented: true }))).toBe(false);
        });
    });

    describe('runWithOptionalViewTransition', () => {
        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('runs the update directly without a DOM', () => {
            const update = vi.fn();
            runWithOptionalViewTransition(update);
            expect(update).toHaveBeenCalledTimes(1);
        });

        it('runs the update directly when motion is reduced', () => {
            const startViewTransition = vi.fn();
            vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
            vi.stubGlobal('document', { startViewTransition });
            const update = vi.fn();
            runWithOptionalViewTransition(update);
            expect(update).toHaveBeenCalledTimes(1);
            expect(startViewTransition).not.toHaveBeenCalled();
        });

        it('wraps the update in a view transition when supported', () => {
            const startViewTransition = vi.fn((callback: () => void) => callback());
            vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
            vi.stubGlobal('document', { startViewTransition });
            const update = vi.fn();
            runWithOptionalViewTransition(update);
            expect(startViewTransition).toHaveBeenCalledTimes(1);
            expect(update).toHaveBeenCalledTimes(1);
        });

        it('falls back to a direct update when view transitions are missing', () => {
            vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
            vi.stubGlobal('document', {});
            const update = vi.fn();
            runWithOptionalViewTransition(update);
            expect(update).toHaveBeenCalledTimes(1);
        });
    });
});

import { describe, expect, it } from 'vitest';
import type { DestinationEvent } from '../../shared/destinationGuides';
import {
  getOccurrenceSortKey,
  getOccurrenceTripWindow,
  resolveNextOccurrence,
  sortFestivalsByNextOccurrence,
  toIsoDay,
  toIsoDayFromDate,
} from '../../services/festivalDateService';

const baseEvent = (overrides: Partial<DestinationEvent>): DestinationEvent => ({
  id: 'test-event',
  name: 'Test Event',
  month: 6,
  type: 'festival',
  summary: 'A test festival.',
  ...overrides,
});

const at = (iso: string): Date => new Date(`${iso}T12:00:00Z`);

describe('services/festivalDateService', () => {
  describe('fixed dates', () => {
    it('resolves a single fixed day in the current year when it is still ahead', () => {
      const event = baseEvent({ month: 7, day: 14, recurrence: { kind: 'fixed' } });
      const occurrence = resolveNextOccurrence(event, at('2026-03-01'));

      expect(occurrence).toMatchObject({
        kind: 'exact',
        date: '2026-07-14',
        endDate: '2026-07-14',
        year: 2026,
        month: 7,
        isOngoing: false,
        source: 'fixed',
      });
    });

    it('resolves a fixed multi-day window and reports it as ongoing mid-festival', () => {
      const event = baseEvent({ month: 4, startDay: 13, endDay: 15, recurrence: { kind: 'fixed' } });

      expect(resolveNextOccurrence(event, at('2026-04-14'))).toMatchObject({
        kind: 'exact',
        date: '2026-04-13',
        endDate: '2026-04-15',
        isOngoing: true,
      });
    });

    it('treats the last day of a window as still upcoming, and the day after as past', () => {
      const event = baseEvent({ month: 4, startDay: 13, endDay: 15, recurrence: { kind: 'fixed' } });

      expect(resolveNextOccurrence(event, at('2026-04-15'))).toMatchObject({ date: '2026-04-13', year: 2026 });
      expect(resolveNextOccurrence(event, at('2026-04-16'))).toMatchObject({ date: '2027-04-13', year: 2027 });
    });

    it('clamps a fixed day that does not exist in a short month', () => {
      const event = baseEvent({ month: 2, day: 31, recurrence: { kind: 'fixed' } });

      expect(resolveNextOccurrence(event, at('2026-01-01'))).toMatchObject({ date: '2026-02-28' });
      expect(resolveNextOccurrence(event, at('2028-01-01'))).toMatchObject({ date: '2028-02-29' });
    });
  });

  describe('movable and lunar dates with known years', () => {
    it('uses a sourced known date rather than the nominal month', () => {
      // Diwali sits in November most years but falls in October in 2027.
      const event = baseEvent({
        month: 11,
        recurrence: { kind: 'lunar' },
        durationDays: 5,
        knownDates: { 2026: '2026-11-06', 2027: '2027-10-27' },
        monthQualifier: 'mid',
      });

      expect(resolveNextOccurrence(event, at('2026-08-18'))).toMatchObject({
        kind: 'exact',
        date: '2026-11-06',
        endDate: '2026-11-10',
        source: 'known',
      });
      expect(resolveNextOccurrence(event, at('2026-12-01'))).toMatchObject({
        kind: 'exact',
        date: '2027-10-27',
        month: 10,
        year: 2027,
      });
    });

    it('falls back to the approximate month once the known years run out', () => {
      const event = baseEvent({
        month: 8,
        recurrence: { kind: 'movable' },
        durationDays: 25,
        knownDates: { 2026: '2026-08-07' },
        monthQualifier: 'throughout',
      });

      expect(resolveNextOccurrence(event, at('2026-08-18'))).toMatchObject({ kind: 'exact', isOngoing: true });
      expect(resolveNextOccurrence(event, at('2026-09-01'))).toEqual({
        kind: 'approximate',
        year: 2027,
        month: 8,
        qualifier: 'throughout',
      });
    });

    it('does not resolve a known date that has already finished', () => {
      const event = baseEvent({ month: 7, knownDates: { 2026: '2026-07-10' }, recurrence: { kind: 'movable' } });

      expect(resolveNextOccurrence(event, at('2026-08-18'))).toEqual({
        kind: 'approximate',
        year: 2027,
        month: 7,
      });
    });
  });

  describe('approximate fallback', () => {
    it('never invents a day when no date information exists', () => {
      const event = baseEvent({ month: 3, recurrence: { kind: 'lunar' }, monthQualifier: 'mid' });
      const occurrence = resolveNextOccurrence(event, at('2026-01-05'));

      expect(occurrence).toEqual({ kind: 'approximate', year: 2026, month: 3, qualifier: 'mid' });
      expect(occurrence).not.toHaveProperty('date');
    });

    it('omits the qualifier when the data does not carry one', () => {
      const event = baseEvent({ month: 3, recurrence: { kind: 'lunar' } });

      expect(resolveNextOccurrence(event, at('2026-01-05'))).toEqual({
        kind: 'approximate',
        year: 2026,
        month: 3,
      });
    });

    it('counts the current month as still upcoming', () => {
      const event = baseEvent({ month: 3, recurrence: { kind: 'seasonal' } });

      expect(resolveNextOccurrence(event, at('2026-03-28'))).toMatchObject({ year: 2026, month: 3 });
    });
  });

  describe('year rollover', () => {
    it('points a January event at next year when asked in December', () => {
      const fixed = baseEvent({ month: 1, day: 6, recurrence: { kind: 'fixed' } });
      const approximate = baseEvent({ month: 1, recurrence: { kind: 'lunar' }, monthQualifier: 'late' });

      expect(resolveNextOccurrence(fixed, at('2026-12-20'))).toMatchObject({ date: '2027-01-06', year: 2027 });
      expect(resolveNextOccurrence(approximate, at('2026-12-20'))).toMatchObject({ year: 2027, month: 1 });
    });

    it('keeps a December event in the current year when asked in December', () => {
      const event = baseEvent({ month: 12, day: 31, recurrence: { kind: 'fixed' } });

      expect(resolveNextOccurrence(event, at('2026-12-20'))).toMatchObject({ date: '2026-12-31', year: 2026 });
    });

    it('surfaces a window that started last December and runs into January', () => {
      const event = baseEvent({
        month: 12,
        recurrence: { kind: 'seasonal' },
        durationDays: 40,
        knownDates: { 2026: '2026-12-15' },
      });

      expect(resolveNextOccurrence(event, at('2027-01-05'))).toMatchObject({
        kind: 'exact',
        date: '2026-12-15',
        endDate: '2027-01-23',
        isOngoing: true,
      });
    });
  });

  describe('ordering', () => {
    it('sorts soonest first and interleaves exact and approximate occurrences', () => {
      const now = at('2026-08-18');
      const events = [
        baseEvent({ id: 'december-fixed', name: 'December Fixed', month: 12, day: 18, recurrence: { kind: 'fixed' } }),
        baseEvent({ id: 'september-approx', name: 'September Approx', month: 9, recurrence: { kind: 'lunar' }, monthQualifier: 'late' }),
        baseEvent({ id: 'august-known', name: 'August Known', month: 8, recurrence: { kind: 'movable' }, knownDates: { 2026: '2026-08-26' } }),
      ];

      expect(sortFestivalsByNextOccurrence(events, now).map((item) => item.event.id)).toEqual([
        'august-known',
        'september-approx',
        'december-fixed',
      ]);
    });

    it('breaks ties on festival name so the order is stable', () => {
      const now = at('2026-01-01');
      const events = [
        baseEvent({ id: 'b', name: 'Beta', month: 5, recurrence: { kind: 'lunar' } }),
        baseEvent({ id: 'a', name: 'Alpha', month: 5, recurrence: { kind: 'lunar' } }),
      ];

      expect(sortFestivalsByNextOccurrence(events, now).map((item) => item.event.name)).toEqual(['Alpha', 'Beta']);
    });

    it('places approximate occurrences inside their month according to the qualifier', () => {
      const early = getOccurrenceSortKey({ kind: 'approximate', year: 2027, month: 5, qualifier: 'early' });
      const late = getOccurrenceSortKey({ kind: 'approximate', year: 2027, month: 5, qualifier: 'late' });
      const unqualified = getOccurrenceSortKey({ kind: 'approximate', year: 2027, month: 5 });

      expect(early < unqualified).toBe(true);
      expect(unqualified < late).toBe(true);
    });
  });

  describe('trip windows', () => {
    it('pads an exact occurrence so travellers arrive before it starts', () => {
      const event = baseEvent({ month: 4, startDay: 13, endDay: 15, recurrence: { kind: 'fixed' } });
      const occurrence = resolveNextOccurrence(event, at('2026-01-01'));

      expect(getOccurrenceTripWindow(occurrence)).toEqual({ startDate: '2026-04-12', endDate: '2026-04-16' });
    });

    it('returns no window for an approximate occurrence so nothing fake reaches the trip form', () => {
      const event = baseEvent({ month: 3, recurrence: { kind: 'lunar' } });

      expect(getOccurrenceTripWindow(resolveNextOccurrence(event, at('2026-01-01')))).toBeUndefined();
    });
  });

  describe('date helpers', () => {
    it('pads ISO day parts', () => {
      expect(toIsoDay(2027, 1, 6)).toBe('2027-01-06');
      expect(toIsoDayFromDate(new Date('2026-11-06T23:30:00Z'))).toBe('2026-11-06');
    });
  });
});

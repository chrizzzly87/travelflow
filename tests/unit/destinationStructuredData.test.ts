import { describe, expect, it } from 'vitest';
import { resolveDestinationGuide } from '../../services/destinationGuideService';
import {
  buildDestinationStructuredData,
  buildFestivalListStructuredData,
  resolveEventSchemaDates,
  resolveEventStartDate,
  serializeStructuredData,
} from '../../services/destinationStructuredData';

const NOW = new Date('2026-08-18T00:00:00.000Z');

const resolveOrThrow = (country: string, child?: string) => {
  const resolved = resolveDestinationGuide(country, child);
  if (!resolved) throw new Error(`Expected a destination guide for ${country}/${child ?? ''}`);
  return resolved;
};

describe('destination structured data', () => {
  it('builds a TouristDestination graph with region, country and events', () => {
    const data = buildDestinationStructuredData({
      resolved: resolveOrThrow('china'),
      canonicalUrl: 'https://travelflowapp.netlify.app/inspirations/country/china',
      now: NOW,
    });

    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('TouristDestination');
    expect(data.name).toBe('China');
    expect(data.url).toBe('https://travelflowapp.netlify.app/inspirations/country/china');
    expect(data.address).toEqual({ '@type': 'PostalAddress', addressCountry: 'CN' });
    expect(data.containedInPlace).toEqual({ '@type': 'Place', name: 'Asia' });

    const events = data.event as Array<Record<string, unknown>>;
    expect(events.length).toBeGreaterThan(0);
    // Spring Festival carries a sourced 2027 date, so the graph publishes the exact day.
    expect(events[0]).toMatchObject({
      '@type': 'Event',
      name: 'Spring Festival',
      startDate: '2027-02-06',
      endDate: '2027-02-13',
    });
  });

  it('nests city guides inside their country and lists curated highlights', () => {
    const data = buildDestinationStructuredData({
      resolved: resolveOrThrow('taiwan', 'taipei'),
      canonicalUrl: 'https://travelflowapp.netlify.app/inspirations/country/taiwan/taipei',
      now: NOW,
    });

    expect(data.containedInPlace).toEqual({ '@type': 'Country', name: 'Taiwan' });
    expect(data.touristAttraction).toEqual([
      { '@type': 'TouristAttraction', name: 'Taipei 101' },
      { '@type': 'TouristAttraction', name: 'National Palace Museum' },
      { '@type': 'TouristAttraction', name: 'Shilin Night Market' },
    ]);
  });

  it('keeps month precision for events that only carry a month', () => {
    const monthOnlyEvent = {
      id: 'seasonal-cultural-events',
      name: 'Seasonal Cultural Events',
      month: 2,
      type: 'culture',
      summary: 'Regional fairs and cultural programs.',
    };

    expect(resolveEventSchemaDates(monthOnlyEvent, NOW)).toEqual({ startDate: '2027-02' });
  });

  it('upgrades to day precision when the event is pinned to real dates', () => {
    const fixedEvent = {
      id: 'songkran',
      name: 'Songkran',
      month: 4,
      type: 'festival',
      summary: 'Thai New Year.',
      startDay: 13,
      endDay: 15,
      recurrence: { kind: 'fixed' as const },
    };

    expect(resolveEventSchemaDates(fixedEvent, NOW)).toEqual({
      startDate: '2027-04-13',
      endDate: '2027-04-15',
    });
  });

  it('builds an ItemList of Event nodes for the festivals index', () => {
    const data = buildFestivalListStructuredData({
      items: [
        {
          countryName: 'Thailand',
          event: {
            id: 'songkran',
            name: 'Songkran',
            month: 4,
            type: 'festival',
            summary: 'Thai New Year.',
            startDay: 13,
            endDay: 15,
            recurrence: { kind: 'fixed' },
          },
        },
        {
          countryName: 'India',
          event: {
            id: 'holi',
            name: 'Holi',
            month: 3,
            type: 'festival',
            summary: 'Festival of colours.',
            recurrence: { kind: 'lunar' },
            monthQualifier: 'mid',
          },
        },
      ],
      canonicalUrl: 'https://travelflowapp.netlify.app/inspirations/events-and-festivals',
      name: 'Festivals',
      now: NOW,
    });

    expect(data['@type']).toBe('ItemList');
    expect(data.numberOfItems).toBe(2);

    const [songkran, holi] = data.itemListElement as Array<{ position: number; item: Record<string, unknown> }>;
    expect(songkran.position).toBe(1);
    expect(songkran.item).toMatchObject({ name: 'Songkran', startDate: '2027-04-13', endDate: '2027-04-15' });
    expect(songkran.item.location).toEqual({ '@type': 'Country', name: 'Thailand' });

    // Holi is lunar and unsourced for upcoming years: month precision, never a day.
    expect(holi.item.startDate).toBe('2027-03');
    expect(holi.item.endDate).toBeUndefined();
  });

  it('resolves month-only events to the next upcoming occurrence', () => {
    expect(resolveEventStartDate(10, NOW)).toBe('2026-10');
    expect(resolveEventStartDate(8, NOW)).toBe('2026-08');
    expect(resolveEventStartDate(2, NOW)).toBe('2027-02');
    expect(resolveEventStartDate(13, NOW)).toBeUndefined();
  });

  it('escapes angle brackets so inline script embedding stays safe', () => {
    expect(serializeStructuredData({ name: '</script><script>alert(1)</script>' }))
      .not.toContain('</script>');
  });
});

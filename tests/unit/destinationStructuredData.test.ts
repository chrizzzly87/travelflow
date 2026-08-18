import { describe, expect, it } from 'vitest';
import { resolveDestinationGuide } from '../../services/destinationGuideService';
import {
  buildDestinationStructuredData,
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
    expect(events[0]).toMatchObject({ '@type': 'Event', name: 'Spring Festival', startDate: '2027-02' });
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

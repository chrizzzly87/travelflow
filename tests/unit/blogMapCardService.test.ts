import { describe, expect, it } from 'vitest';
import {
  buildGoogleMapsCategoryQuery,
  buildGoogleMapsEmbedUrl,
  buildGoogleMapsSpotQuery,
  buildGoogleMapsSearchUrl,
  parseBlogMapCardConfig,
} from '../../services/blogMapCardService';

describe('services/blogMapCardService', () => {
  it('parses a valid tf-map config and keeps explicit defaults', () => {
    const raw = JSON.stringify({
      title: 'Husum entdecken',
      description: 'Spot guide',
      defaultCategoryId: 'food',
      defaultSpotId: 'krabbe',
      regionContext: 'Husum, Nordfriesland',
      mapCenter: { lat: 54.4765, lng: 9.0513 },
      mapZoom: 13,
      categories: [
        {
          id: 'food',
          label: 'Krabbenbrötchen',
          icon: '🦐',
          spots: [
            { id: 'krabbe', name: 'Fischhaus Loof', query: 'Fischhaus Loof Husum', note: 'Direkt am Hafen' },
          ],
        },
      ],
    });

    const parsed = parseBlogMapCardConfig(raw);
    expect(parsed).toBeTruthy();
    expect(parsed?.title).toBe('Husum entdecken');
    expect(parsed?.defaultCategoryId).toBe('food');
    expect(parsed?.defaultSpotId).toBe('krabbe');
    expect(parsed?.regionContext).toBe('Husum, Nordfriesland');
    expect(parsed?.mapCenter).toEqual({ lat: 54.4765, lng: 9.0513 });
    expect(parsed?.mapZoom).toBe(13);
    expect(parsed?.categories[0].spots[0].note).toBe('Direkt am Hafen');
  });

  it('normalizes ids and drops invalid category/spot entries', () => {
    const raw = JSON.stringify({
      title: 'Guide',
      defaultCategoryId: 'missing',
      defaultSpotId: 'missing',
      categories: [
        { label: 'Broken', spots: [{ name: '', query: 'invalid' }] },
        {
          label: 'Activities & Sightseeing',
          spots: [
            { name: 'Schlosspark', query: 'Schlosspark Husum' },
            { name: 'Schlosspark', query: 'Schlosspark Husum' },
          ],
        },
      ],
    });

    const parsed = parseBlogMapCardConfig(raw);
    expect(parsed).toBeTruthy();
    expect(parsed?.categories).toHaveLength(1);
    expect(parsed?.categories[0].id).toBe('activities-sightseeing-1');
    expect(parsed?.categories[0].spots[0].id).toBe('schlosspark-0');
    expect(parsed?.categories[0].spots[1].id).toBe('schlosspark-1');
    expect(parsed?.defaultCategoryId).toBeUndefined();
    expect(parsed?.defaultSpotId).toBeUndefined();
  });

  it('returns null for invalid payloads', () => {
    expect(parseBlogMapCardConfig('not json')).toBeNull();
    expect(parseBlogMapCardConfig(JSON.stringify({ title: 'Missing categories' }))).toBeNull();
    expect(parseBlogMapCardConfig(JSON.stringify({ title: '', categories: [] }))).toBeNull();
  });

  it('builds Google Maps URLs with encoded query params', () => {
    const embed = buildGoogleMapsEmbedUrl('Dockkoog Husum & Wattenmeer', 'de', {
      center: { lat: 54.4765, lng: 9.0513 },
      zoom: 13,
    });
    expect(embed).toContain('maps?');
    expect(embed).toContain('hl=de');
    expect(embed).toContain('ll=54.4765%2C9.0513');
    expect(embed).toContain('z=13');
    expect(embed).toContain('Dockkoog+Husum+%26+Wattenmeer');

    const search = buildGoogleMapsSearchUrl('Schlosspark Husum');
    expect(search).toBe('https://www.google.com/maps/search/?api=1&query=Schlosspark+Husum');
  });

  it('builds a category query that includes all spots', () => {
    const query = buildGoogleMapsCategoryQuery([
      { id: 'hafen', name: 'Hafen', query: 'Husumer Hafen' },
      { id: 'park', name: 'Schlosspark', query: 'Schlosspark Husum' },
    ], 'Husum, Nordfriesland');
    expect(query).toBe('(Husumer Hafen, Husum, Nordfriesland) OR (Schlosspark Husum, Husum, Nordfriesland)');
  });

  it('builds a spot query with optional region context', () => {
    expect(buildGoogleMapsSpotQuery('Schlosspark Husum')).toBe('Schlosspark Husum');
    expect(buildGoogleMapsSpotQuery('Schlosspark Husum', 'Husum, Nordfriesland')).toBe('Schlosspark Husum, Husum, Nordfriesland');
    expect(buildGoogleMapsSpotQuery('   ', 'Husum')).toBe('');
  });
});

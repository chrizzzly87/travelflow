import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('components/ItineraryMap marker compatibility', () => {
  it('does not instantiate deprecated google.maps.Marker constructors', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'components/ItineraryMap.tsx'),
      'utf8'
    );

    expect(source).not.toContain('new window.google.maps.Marker(');
    expect(source).not.toContain('new google.maps.Marker(');
  });

  it('does not instantiate deprecated google.maps.DirectionsService', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'components/ItineraryMap.tsx'),
      'utf8'
    );

    expect(source).not.toContain('new window.google.maps.DirectionsService(');
    expect(source).not.toContain('google.maps.DirectionsService');
  });
});

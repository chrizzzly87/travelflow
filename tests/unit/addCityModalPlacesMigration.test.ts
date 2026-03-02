import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('components/AddCityModal places migration', () => {
  it('does not use deprecated places autocomplete constructor', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'components/AddCityModal.tsx'),
      'utf8'
    );

    expect(source).not.toContain('google.maps.places.Autocomplete');
    expect(source).toContain('searchCitySuggestions');
    expect(source).toContain('resolveCitySuggestion');
  });
});

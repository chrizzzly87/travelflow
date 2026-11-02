import { describe, expect, it } from 'vitest';
import { Route as PublicArea } from '../../src/routes/areas/public';
import { Route as AccountArea } from '../../src/routes/areas/account';
import { Route as TripsArea } from '../../src/routes/areas/trips';

describe('document cache policy', () => {
    it('lets the CDN keep public documents while browsers revalidate', () => {
        const headers = (PublicArea.options.headers as () => Record<string, string>)();
        expect(headers['cache-control']).toBe('public, max-age=0, must-revalidate');
        expect(headers['netlify-cdn-cache-control']).toMatch(/s-maxage=\d+/);
    });

    it('never declares session areas publicly cacheable', () => {
        for (const area of [AccountArea, TripsArea]) expect(area.options.headers).toBeUndefined();
    });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('index.html bootstrap shell', () => {
  const indexHtmlPath = resolve(process.cwd(), 'index.html');
  const html = readFileSync(indexHtmlPath, 'utf8');
  const bootstrapMarkupMatch = html.match(/<div id="app-bootstrap-shell">([\s\S]*?)<div id="root"><\/div>/);
  const bootstrapMarkup = bootstrapMarkupMatch?.[1] ?? '';

  it('renders the branded marketing shell by default', () => {
    expect(html).toContain('id="app-bootstrap-shell"');
    expect(html).toContain('class="tf-boot-header-inner"');
    expect(html).toContain('class="tf-boot-nav"');
    expect(html).toContain('src="/brand-plane.svg"');
    expect(html).toContain('TravelFlow');
    expect(bootstrapMarkup).toContain('class="tf-bone tf-boot-nav-skeleton tf-boot-nav-skeleton--features"');
    expect(bootstrapMarkup).toContain('class="tf-bone tf-boot-control-flag"');
    expect(bootstrapMarkup).toContain('class="tf-bone tf-boot-control-skeleton tf-boot-control-skeleton--cta"');
    expect(bootstrapMarkup).not.toContain('Features</span>');
    expect(bootstrapMarkup).not.toContain('Create Trip</span>');
    expect(bootstrapMarkup).not.toContain('class="tf-boot-planner"');
  });

  it('switches only the bootstrap header on trip-like routes before hydration', () => {
    expect(html).toContain("document.documentElement.setAttribute('data-tf-boot-route', 'trip')");
    expect(html).toContain("window.location.pathname || '/'");
    expect(bootstrapMarkup).toContain('class="tf-boot-header tf-boot-header--marketing"');
    expect(bootstrapMarkup).toContain('class="tf-boot-trip-header tf-boot-header--trip"');
    expect(html).toContain('(?:trip|s|example)');
  });

  it('keeps the React root outside the bootstrap shell container', () => {
    expect(html).toMatch(/<\/div>\s*<\/div>\s*<div id="root"><\/div>/);
  });

  describe('map host preconnects', () => {
    /**
     * The literal source of truth, rebuilt from the inline boot script rather
     * than copied, so this cannot drift from what ships.
     */
    const tripRoutePattern = (() => {
      const match = html.match(/const isTripLikeRoute = \/(.+?)\/([gimsuy]*)\.test\(path\);/);
      if (!match) throw new Error('trip-route pattern not found in index.html');
      return new RegExp(match[1], match[2]);
    })();

    it('covers real trips, shared trips and examples, in every locale', () => {
      // Real trips matter most: they are what travellers actually open, and an
      // earlier reading of this only checked /example.
      expect(tripRoutePattern.test('/trip/abc-123')).toBe(true);
      expect(tripRoutePattern.test('/de/trip/abc-123')).toBe(true);
      expect(tripRoutePattern.test('/s/share-token')).toBe(true);
      expect(tripRoutePattern.test('/ko/s/share-token')).toBe(true);
      expect(tripRoutePattern.test('/example/japan-spring')).toBe(true);
      expect(tripRoutePattern.test('/pt/example/japan-spring')).toBe(true);
    });

    it('leaves pages that never show a map alone', () => {
      expect(tripRoutePattern.test('/')).toBe(false);
      expect(tripRoutePattern.test('/pricing')).toBe(false);
      expect(tripRoutePattern.test('/blog/some-post')).toBe(false);
      expect(tripRoutePattern.test('/de/inspirations')).toBe(false);
      expect(tripRoutePattern.test('/trips')).toBe(false);
    });

    it('warms Mapbox first, because it draws the basemap and carries the bytes', () => {
      const hosts = [...html.matchAll(/\['(https:\/\/[^']+)', (true|false)\]/g)]
        .map((match) => ({ host: match[1], cors: match[2] === 'true' }));

      expect(hosts.map((entry) => entry.host)).toEqual([
        'https://api.mapbox.com',
        'https://maps.googleapis.com',
        'https://maps.gstatic.com',
      ]);
      // Only the CORS host needs the credentialed connection.
      expect(hosts.find((entry) => entry.host === 'https://api.mapbox.com')?.cors).toBe(true);
      expect(hosts.find((entry) => entry.host === 'https://maps.googleapis.com')?.cors).toBe(false);
    });
  });
});

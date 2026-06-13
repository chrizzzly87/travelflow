import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('generated sitemap marketing manifest coverage', () => {
  const sitemap = readFileSync('public/sitemap.xml', 'utf8');

  it('includes Astro-owned localized marketing pages', () => {
    expect(sitemap).toContain('<loc>https://travelflowapp.netlify.app/features</loc>');
    expect(sitemap).toContain('<loc>https://travelflowapp.netlify.app/de/features</loc>');
    expect(sitemap).toContain('<loc>https://travelflowapp.netlify.app/fa/pricing</loc>');
    expect(sitemap).toContain('hreflang="ur" href="https://travelflowapp.netlify.app/ur/contact"');
    expect(sitemap).toContain('<loc>https://travelflowapp.netlify.app/inspirations/country/New%20Zealand</loc>');
    expect(sitemap).toContain('<loc>https://travelflowapp.netlify.app/fa/inspirations/country/New%20Zealand</loc>');
  });

  it('keeps app-shell routes and localized slug aliases out of the marketing sitemap', () => {
    expect(sitemap).not.toContain('<loc>https://travelflowapp.netlify.app/login</loc>');
    expect(sitemap).not.toContain('<loc>https://travelflowapp.netlify.app/create-trip</loc>');
    expect(sitemap).not.toContain('<loc>https://travelflowapp.netlify.app/de/impressum</loc>');
  });

  it('includes published blog posts with lastmod metadata', () => {
    expect(sitemap).toContain('<loc>https://travelflowapp.netlify.app/blog/how-to-plan-multi-city-trip</loc>');
    expect(sitemap).toContain('<lastmod>2026-02-05T10:00:00Z</lastmod>');
    expect(sitemap).toContain('<loc>https://travelflowapp.netlify.app/de/blog/husum-weekend-krokusbluetenfest</loc>');
  });
});

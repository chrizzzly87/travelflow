import { describe, expect, it } from 'vitest';
import destinationsEndpoint from '../../netlify/edge-functions/destinations';

const readJson = async (response: Response) => response.json() as Promise<Record<string, any>>;

describe('GET /api/destinations', () => {
  it('lists the 50 country launch guides', async () => {
    const response = await destinationsEndpoint(new Request('https://example.test/api/destinations?limit=50'));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(50);
    expect(body.meta.count).toBe(50);
    expect(body.meta.source).toBe('snapshot');
  });

  it('returns country detail with typed children', async () => {
    const response = await destinationsEndpoint(new Request('https://example.test/api/destinations/thailand'));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.data.slug).toBe('thailand');
    expect(body.data.children.some((guide: { slug: string }) => guide.slug === 'phuket')).toBe(true);
  });

  it('returns nested island detail with inherited seasonality', async () => {
    const response = await destinationsEndpoint(new Request('https://example.test/api/destinations/spain/mallorca'));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ slug: 'mallorca', kind: 'island' });
    expect(body.data.seasonality.idealMonths.length).toBeGreaterThan(0);
    expect(body.meta.inheritedFrom).toBe('country:spain');
  });

  it('rejects unsupported methods and invalid filters', async () => {
    const methodResponse = await destinationsEndpoint(new Request('https://example.test/api/destinations', { method: 'POST' }));
    const filterResponse = await destinationsEndpoint(new Request('https://example.test/api/destinations?type=region'));

    expect(methodResponse.status).toBe(405);
    expect(filterResponse.status).toBe(400);
  });
});


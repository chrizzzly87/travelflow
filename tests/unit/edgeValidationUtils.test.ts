import { describe, expect, it } from 'vitest';
import {
  findCatchAllEdgeEntries,
  findSiteOgMetaScopeViolations,
  parseEdgeFunctionEntries,
} from '../../scripts/edge-validation-utils.mjs';

describe('edge validation utils', () => {
  it('parses edge function entries from netlify.toml blocks', () => {
    const toml = `
[[edge_functions]]
  path = "/api/health"
  function = "health"

[[edge_functions]]
  path = "/trip/*"
  function = "trip-og-meta"

[[headers]]
  for = "/assets/*"
`;

    const entries = parseEdgeFunctionEntries(toml);
    expect(entries).toEqual([
      { path: '/api/health', functionName: 'health' },
      { path: '/trip/*', functionName: 'trip-og-meta' },
    ]);
  });

  it('detects catch-all edge route bindings', () => {
    const entries = [
      { path: '/api/health', functionName: 'health' },
      { path: '/*', functionName: 'site-og-meta' },
      { path: '/trip/*', functionName: 'trip-og-meta' },
    ];

    const catchAll = findCatchAllEdgeEntries(entries);
    expect(catchAll).toEqual([{ path: '/*', functionName: 'site-og-meta' }]);
  });

  it('detects disallowed site-og-meta route scope', () => {
    const entries = [
      { path: '/', functionName: 'site-og-meta' },
      { path: '/example/*', functionName: 'site-og-meta' },
      { path: '/de/features', functionName: 'site-og-meta' },
      { path: '/de/*', functionName: 'site-og-meta' },
      { path: '/trip/*', functionName: 'trip-og-meta' },
    ];

    const violations = findSiteOgMetaScopeViolations(entries);
    expect(violations).toEqual([
      {
        path: '/de/*',
        functionName: 'site-og-meta',
        reason: 'site-og-meta must only be mapped to approved static/example route allowlists. Found disallowed path "/de/*".',
      },
    ]);
  });

  it('passes approved site-og-meta allowlist routes', () => {
    const entries = [
      { path: '/', functionName: 'site-og-meta' },
      { path: '/inspirations/*', functionName: 'site-og-meta' },
      { path: '/blog/*', functionName: 'site-og-meta' },
      { path: '/example/*', functionName: 'site-og-meta' },
      { path: '/de', functionName: 'site-og-meta' },
      { path: '/de/inspirations/*', functionName: 'site-og-meta' },
      { path: '/de/blog/*', functionName: 'site-og-meta' },
      { path: '/de/create-trip', functionName: 'site-og-meta' },
      { path: '/fa/pricing', functionName: 'site-og-meta' },
      { path: '/ur/create-trip', functionName: 'site-og-meta' },
      { path: '/trip/*', functionName: 'trip-og-meta' },
    ];

    expect(findSiteOgMetaScopeViolations(entries)).toEqual([]);
  });
});

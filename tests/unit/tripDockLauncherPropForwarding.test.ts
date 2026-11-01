import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// v0.192.0 lifted the view-only card above the "Plan with AI" launcher, but
// TripView renders the card through TripViewModalLayer, which received the
// flag and never forwarded it. JSX here does not reject undeclared props, and
// the component tests rendered the card directly, so nothing noticed and the
// card stayed under the launcher in production. Every render site of a
// corner card must pass the launcher flag explicitly.
const read = (relative: string) => readFileSync(path.resolve(__dirname, '../..', relative), 'utf8');

const renderSites = (source: string, component: string): string[] => {
  const sites: string[] = [];
  const pattern = new RegExp(`<${component}\\b`, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const end = source.indexOf('/>', match.index);
    sites.push(source.slice(match.index, end));
  }
  return sites;
};

describe('AI launcher clearance reaches every corner card', () => {
  const tripView = read('components/TripView.tsx');
  const modalLayer = read('components/tripview/TripViewModalLayer.tsx');

  it.each([
    ['TripViewStatusBanners', 'TripView', tripView],
    ['TripViewModalLayer', 'TripView', tripView],
    ['TripViewHudOverlays', 'TripViewModalLayer', modalLayer],
  ])(
    'every <%s> in %s passes isAgentLauncherVisible',
    (component, _owner, source) => {
      const sites = renderSites(source, component);
      expect(sites.length).toBeGreaterThan(0);
      for (const site of sites) {
        expect(site).toMatch(/\bisAgentLauncherVisible=\{/);
      }
    },
  );

  it('TripViewModalLayer forwards the flag instead of swallowing it', () => {
    const [hud] = renderSites(modalLayer, 'TripViewHudOverlays');
    expect(hud).toMatch(/isAgentLauncherVisible=\{isAgentLauncherVisible\}/);
  });
});

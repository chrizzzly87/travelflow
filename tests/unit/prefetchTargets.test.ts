import { describe, expect, it } from 'vitest';

import { resolvePrefetchTargets } from '../../config/prefetchTargets';

describe('config/prefetchTargets', () => {
  it('warms deferred marketing routes with their router chunk and page chunk', () => {
    expect(resolvePrefetchTargets('/pricing').map((target) => target.key)).toEqual([
      'route:deferred-app-routes',
      'route:pricing',
    ]);

    expect(resolvePrefetchTargets('/blog').map((target) => target.key)).toEqual(
      expect.arrayContaining([
        'route:deferred-app-routes',
        'route:blog',
      ])
    );
  });

  it('warms protected deferred routes with their router chunk and page chunk', () => {
    expect(resolvePrefetchTargets('/profile').map((target) => target.key)).toEqual([
      'route:deferred-app-routes',
      'route:profile',
    ]);
  });

  it('keeps direct create-trip entry on its dedicated route chunk only', () => {
    expect(resolvePrefetchTargets('/create-trip', 'off').map((target) => target.key)).toEqual([
      'route:create-trip-lab-classic',
      'component:trip-view',
    ]);
  });

  it('warms only the promoted shape planner when the structured rollout is active', () => {
    expect(resolvePrefetchTargets('/create-trip', 'primary').map((target) => target.key)).toEqual([
      'route:create-trip-shape',
      'component:trip-view',
    ]);
    expect(resolvePrefetchTargets('/de/create-trip/wizard', 'wizard').map((target) => target.key)).toEqual([
      'route:create-trip-shape',
      'component:trip-view',
    ]);
  });
});

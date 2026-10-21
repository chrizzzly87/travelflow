import React from 'react';

import { loadLazyComponentWithRecovery } from '../../services/lazyImportRecovery';

// Goes through the same stale-chunk recovery as every other lazy route: a tab
// opened before a deploy still asks for the previous build's hashed chunk,
// which no longer exists. Recovery reloads once to pick up the new build
// instead of crashing the trip page with "Failed to fetch dynamically
// imported module".
export const LazyTripView = React.lazy(async () => {
    const module = await loadLazyComponentWithRecovery('TripView', () => import('../TripView'));
    return { default: module.TripView };
});

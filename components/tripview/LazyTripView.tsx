import React from 'react';

export const LazyTripView = React.lazy(async () => {
    const module = await import('../TripView');
    return { default: module.TripView };
});

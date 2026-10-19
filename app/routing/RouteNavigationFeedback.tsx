import React from 'react';
import { useRouterState } from '@tanstack/react-router';

/** Foreground work only: preloads never change the router's pending status. */
export function RouteNavigationFeedback() {
    const pending = useRouterState({ select: state => state.status === 'pending' });
    return <div aria-hidden="true" data-testid="route-navigation-progress" data-pending={pending || undefined} className="tf-navigation-progress"><span /></div>;
}

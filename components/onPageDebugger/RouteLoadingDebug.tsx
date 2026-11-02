import React from 'react';
import { useRouterState } from '@tanstack/react-router';

/** Observe public router state without maintaining a parallel asset-warming registry. */
export function RouteLoadingDebug() {
    const { status, isLoading, location, matches } = useRouterState();
    return (
        <section className="mt-3 rounded-md border border-border bg-card p-2 text-xs" aria-label="Native route loading">
            <h3 className="font-semibold uppercase tracking-wide text-muted-foreground">TanStack route loading</h3>
            <p className="mt-1 text-muted-foreground">Links preload their matched route on intent.</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 break-all">
                <dt>Status</dt><dd>{status}</dd>
                <dt>Loading</dt><dd>{isLoading ? 'Yes' : 'No'}</dd>
                <dt>Location</dt><dd>{location.href}</dd>
            </dl>
            <h4 className="mt-2 font-semibold">Active routes</h4>
            <ul className="mt-1 space-y-1 break-all">
                {matches.map(match => <li key={match.id}>{match.routeId}: {match.status}</li>)}
            </ul>
        </section>
    );
}

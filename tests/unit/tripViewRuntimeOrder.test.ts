import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('components/TripView runtime ordering', () => {
    it('declares viewport state before callbacks that depend on it', () => {
        const source = readFileSync(
            resolve(process.cwd(), 'components/TripView.tsx'),
            'utf8',
        );

        const viewportStateIndex = source.indexOf('const [isMobileViewport, setIsMobileViewport]');
        const paywallHandlerIndex = source.indexOf('const handlePaywallActivateClick = useCallback');
        const pendingAuthHandlerIndex = source.indexOf('const handleResolvePendingAuthGeneration = useCallback');

        expect(viewportStateIndex).toBeGreaterThan(-1);
        expect(paywallHandlerIndex).toBeGreaterThan(-1);
        expect(pendingAuthHandlerIndex).toBeGreaterThan(-1);
        expect(viewportStateIndex).toBeLessThan(paywallHandlerIndex);
        expect(viewportStateIndex).toBeLessThan(pendingAuthHandlerIndex);
    });

    it('passes the live zoom level into the planner workspace', () => {
        const source = readFileSync(
            resolve(process.cwd(), 'components/TripView.tsx'),
            'utf8',
        );

        const workspaceIndex = source.indexOf('<TripViewPlannerWorkspace');
        const zoomPropIndex = source.indexOf('zoomLevel={zoomLevel}');
        const dockModePropIndex = source.indexOf('mapDockMode={mapDockMode}');

        expect(workspaceIndex).toBeGreaterThan(-1);
        expect(zoomPropIndex).toBeGreaterThan(-1);
        expect(dockModePropIndex).toBeGreaterThan(-1);
        expect(zoomPropIndex).toBeGreaterThan(workspaceIndex);
        expect(zoomPropIndex).toBeLessThan(dockModePropIndex);
    });
});

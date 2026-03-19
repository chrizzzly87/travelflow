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

    it('keeps zoom behavior and details width in the live view snapshot wiring', () => {
        const source = readFileSync(
            resolve(process.cwd(), 'components/TripView.tsx'),
            'utf8',
        );

        const currentViewSettingsIndex = source.indexOf('const currentViewSettings: IViewSettings = useMemo(() => ({');
        const zoomBehaviorIndex = source.indexOf('zoomBehavior,', currentViewSettingsIndex);
        const detailsWidthIndex = source.indexOf('detailsWidth: Math.round', currentViewSettingsIndex);
        const syncHookIndex = source.indexOf('useTripViewSettingsSync({');
        const syncZoomBehaviorIndex = source.indexOf('zoomBehavior,', syncHookIndex);
        const syncDetailsWidthIndex = source.indexOf('detailsWidth,', syncHookIndex);

        expect(currentViewSettingsIndex).toBeGreaterThan(-1);
        expect(zoomBehaviorIndex).toBeGreaterThan(currentViewSettingsIndex);
        expect(detailsWidthIndex).toBeGreaterThan(zoomBehaviorIndex);
        expect(syncHookIndex).toBeGreaterThan(-1);
        expect(syncZoomBehaviorIndex).toBeGreaterThan(syncHookIndex);
        expect(syncDetailsWidthIndex).toBeGreaterThan(syncZoomBehaviorIndex);
    });

    it('keeps mobile trip selection in the mainline two-step details mode', () => {
        const source = readFileSync(
            resolve(process.cwd(), 'components/TripView.tsx'),
            'utf8',
        );

        const selectionControllerIndex = source.indexOf('} = useTripSelectionController({');
        const autoOpenIndex = source.indexOf('autoOpenOnSelect: !isMobileViewport');
        const clearSelectionIndex = source.indexOf('clearSelectionOnClose: isMobileViewport');

        expect(selectionControllerIndex).toBeGreaterThan(-1);
        expect(autoOpenIndex).toBeGreaterThan(-1);
        expect(clearSelectionIndex).toBeGreaterThan(-1);
        expect(autoOpenIndex).toBeGreaterThan(selectionControllerIndex);
        expect(clearSelectionIndex).toBeGreaterThan(autoOpenIndex);
    });

    it('absorbs pending visual commits into later data commits', () => {
        const source = readFileSync(
            resolve(process.cwd(), 'components/TripView.tsx'),
            'utf8',
        );

        const scheduleCommitIndex = source.indexOf('const scheduleCommit = useCallback((');
        const nextTripGuardIndex = source.indexOf('if (nextTrip && pendingManualVisualCommitRef.current)');
        const absorbResetIndex = source.indexOf("pendingManualVisualCommitRef.current = false;", nextTripGuardIndex);

        expect(scheduleCommitIndex).toBeGreaterThan(-1);
        expect(nextTripGuardIndex).toBeGreaterThan(scheduleCommitIndex);
        expect(absorbResetIndex).toBeGreaterThan(nextTripGuardIndex);
    });
});

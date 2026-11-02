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

    it('passes a declared orchestration binding into the abort-and-retry capability check', () => {
        const source = readFileSync(
            resolve(process.cwd(), 'components/TripView.tsx'),
            'utf8',
        );

        // Regression: the abort-and-retry options object referenced a bare
        // `latestAttemptOrchestration`, which threw a ReferenceError as soon as a
        // generation exceeded the timeout and `isGenerationSlow` became true.
        expect(source).toContain('const latestGenerationAttemptOrchestration = useMemo(');
        expect(source).toContain('latestAttemptOrchestration: latestGenerationAttemptOrchestration,');
        expect(source).not.toMatch(/^\s*latestAttemptOrchestration,\s*$/m);
    });
    it('calls the layout sizing and selection hooks where their effects used to run', () => {
        const source = readFileSync(
            resolve(process.cwd(), 'components/TripView.tsx'),
            'utf8',
        );

        // The trip.id reset effect ran before the floating-map write effect.
        const layoutSizingIndex = source.indexOf('} = useTripLayoutSizing({');
        const floatingMapWriteIndex = source.indexOf('writeFloatingMapPreviewState({ mode: mapDockMode });');
        // The selection prune effect ran right after the viewport resize effect.
        const viewportResizeIndex = source.indexOf("window.addEventListener('resize', handleResize);");
        const selectionIndex = source.indexOf('} = useTripSelection({ tripItems: trip.items });');
        const selectionControllerIndex = source.indexOf('} = useTripSelectionController({');
        // The docked-pane rebalance layout effect ran right after the resize controls.
        const resizeControlsIndex = source.indexOf('} = useTripResizeControls({');
        const rebalanceIndex = source.indexOf('useDockedPaneRebalance({');

        for (const index of [
            layoutSizingIndex,
            floatingMapWriteIndex,
            viewportResizeIndex,
            selectionIndex,
            selectionControllerIndex,
            resizeControlsIndex,
            rebalanceIndex,
        ]) {
            expect(index).toBeGreaterThan(-1);
        }
        expect(layoutSizingIndex).toBeLessThan(floatingMapWriteIndex);
        expect(viewportResizeIndex).toBeLessThan(selectionIndex);
        expect(selectionIndex).toBeLessThan(selectionControllerIndex);
        expect(resizeControlsIndex).toBeLessThan(rebalanceIndex);
        const betweenResizeAndRebalance = source.slice(resizeControlsIndex, rebalanceIndex);
        expect(betweenResizeAndRebalance).not.toMatch(/\buse(Layout)?Effect\(/);
        expect(betweenResizeAndRebalance.match(/\buse[A-Z]\w*\(/g)).toEqual(['useTripResizeControls(']);
    });
});

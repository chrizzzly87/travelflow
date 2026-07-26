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
});

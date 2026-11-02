// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { shouldResolveTripMetadata } from '../../src/document/tripMetadataPolicy';

describe('trip document metadata policy', () => {
    it('resolves share and trip metadata only while rendering on the server', () => {
        expect(shouldResolveTripMetadata('/s/token')).toBe(true);
        expect(shouldResolveTripMetadata('/trip/abc')).toBe(true);
        expect(shouldResolveTripMetadata('/pricing')).toBe(false);
        expect(shouldResolveTripMetadata('/tripping')).toBe(false);
    });
});

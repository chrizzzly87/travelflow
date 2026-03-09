import { describe, expect, it } from 'vitest';
import { getBlogImageMedia } from '../../data/blogImageMedia';

describe('data/blogImageMedia', () => {
    it('reuses one landscape source set for card and header variants', () => {
        const media = getBlogImageMedia('how-to-plan-multi-city-trip', 'How to Plan the Perfect Multi-City Trip');

        expect(media.card.sources).toEqual(media.header.sources);
        expect(media.card.sources.large).toBe('/images/blog/how-to-plan-multi-city-trip-card.webp');
        expect(media.header.sources.large).toBe('/images/blog/how-to-plan-multi-city-trip-card.webp');
    });
});

